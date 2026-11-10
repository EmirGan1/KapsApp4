import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import multer from "multer";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { registerStagedUploads } from "../src/server/stagedUploads";
import { UPLOAD_CHUNK_BYTES } from "../src/utils/uploadLimits";

test("a 1 MiB gateway still permits a 1.69 MB MP4 and a 46.65 MB course ZIP, preserving bytes and metadata", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "kaps-upload-test-"));
  const uploads = path.join(temp, "uploads");
  await mkdir(uploads);
  const app = express();
  app.use((req, res, next) => {
    if (Number(req.headers["content-length"]) > 1024 * 1024) res.sendStatus(413);
    else next();
  });
  app.use(express.json());
  const auth = (token: string | undefined) => token === "Bearer user" ? 1 : token === "Bearer other" ? 2 : null;
  const receive = registerStagedUploads(app, uploads, async req => {
    const id = auth(req.headers.authorization);
    return id ? { id } : null;
  });
  const legacy = multer({ dest: uploads }).single("file");
  app.post(["/api/upload", "/api/courses/Physics/files"], async (req, res) => {
    const owner = auth(req.headers.authorization);
    if (!owner) return void res.sendStatus(401);
    await receive(req, res, owner, legacy, async error => {
      assert.ifError(error);
      assert.ok(req.file);
      const bytes = await readFile(req.file.path);
      res.json({ size: req.file.size, name: req.file.originalname, mime: req.file.mimetype, fields: req.body,
        sha: createHash("sha256").update(bytes).digest("hex") });
    });
  });

  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const request = (url: string, method: string, body?: unknown, user = "user") => {
      const bytes = body instanceof Uint8Array;
      return fetch(base + url, { method, headers: { Authorization: `Bearer ${user}`,
        "Content-Type": bytes ? "application/octet-stream" : "application/json" },
        body: bytes ? body as Buffer<ArrayBuffer> : body === undefined ? undefined : JSON.stringify(body) });
    };
    const stage = "/api/upload/staged";
    for (const [name,mime,size,route] of [
      ["video.mp4", "video/mp4", 1_690_000, "/api/upload"],
      ["lecture.zip", "application/zip", 46_650_000, "/api/courses/Physics/files"],
    ] as const) {
      assert.equal((await request(route,"POST",Buffer.alloc(1_100_000))).status,413);
      const start = await request(stage,"POST",{ filename:name,mimetype:mime,size });
      assert.equal(start.status,201);
      const { id } = await start.json() as { id: string };
      const session = stage + "/" + id;
      const fields = { docType: "other", allTopics: "true", "topics[]": "ALL" };
      const final = { stagedUploadId:id,fields };
      assert.equal((await request(route,"POST",final)).status,409);
      assert.equal((await request(session+"?offset=0","PUT",Buffer.alloc(UPLOAD_CHUNK_BYTES),"other")).status,404);
      assert.equal((await request(session+"?offset=1","PUT",Buffer.alloc(UPLOAD_CHUNK_BYTES))).status,409);
      const hash = createHash("sha256");
      for(let offset=0;offset<size;offset+=UPLOAD_CHUNK_BYTES) {
        const chunk=Buffer.alloc(Math.min(UPLOAD_CHUNK_BYTES,size-offset),offset/UPLOAD_CHUNK_BYTES);
        hash.update(chunk);
        assert.equal((await request(session+"?offset="+offset,"PUT",chunk)).status,204);
      }
      assert.equal((await request(route,"POST",final,"other")).status,409);
      const finished = await request(route,"POST",final);
      assert.equal(finished.status,200);
      assert.deepEqual(await finished.json(),{ name,mime,size,fields,sha:hash.digest("hex") });
      assert.equal((await request(route,"POST",final)).status,409);
    }
    assert.deepEqual(await readdir(path.join(temp,".upload-staging")),[]);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(temp,{recursive:true,force:true});
  }
});
