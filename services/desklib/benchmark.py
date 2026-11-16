"""Offline benchmark with JSONL records containing id, source, label, and text.

Use verified labels: human, ai, or edited. Reports contain IDs and metrics only.
"""
import argparse
import json
import resource
import statistics
import time

from model import Detector


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("jsonl")
    args = parser.parse_args()
    with open(args.jsonl, encoding="utf-8") as handle:
        samples = [json.loads(line) for line in handle if line.strip()]

    clock = time.perf_counter
    start = clock()
    detector = Detector()
    print(json.dumps({"loadAndWarmMs": round((clock() - start) * 1000)}), flush=True)
    durations = []
    counts = {label: {"scored": 0, "skipped": 0, "wrongAt0_5": 0, "mixed": 0, "wrongReportedSignal": 0}
              for label in ("human", "ai")}
    for record in samples:
        text = record["text"]
        start = clock()
        result = detector.analyze(text)
        duration = round((clock() - start) * 1000)
        scores = result["scores"]
        segments = result["segmentAi"]
        summary = {"id": record["id"], "label": record["label"], "language": result["language"],
                   "words": result["words"], "tokens": result["tokens"], "ms": duration}
        if scores is not None:
            durations.append(duration)
            vote = "ai" if all(x >= 0.5 for x in segments) else "human" if all(x < 0.5 for x in segments) else "mixed"
            summary.update(ai=scores[1], segments=segments, vote=vote)
        label = record["label"]
        if label in counts:
            bucket = counts[label]
            if scores is None:
                bucket["skipped"] += 1
            else:
                bucket["scored"] += 1
                bucket["wrongAt0_5"] += int((scores[1] >= 0.5) != (label == "ai"))
                bucket["mixed"] += int(vote == "mixed")
                bucket["wrongReportedSignal"] += int(vote not in (label, "mixed"))
        print(json.dumps(summary), flush=True)

    reference = next(sample["text"] for sample in samples
                     if detector.language(sample["text"]) == "english")
    ids = detector.tokenizer.encode(reference, max_length=512, truncation=True)
    first = detector.score(ids)
    repeated = [detector.score(ids) for _ in range(3)]
    fixed = detector.score(ids, pad_to=768)
    print(json.dumps({"counts": counts, "scoredMedianMs": statistics.median(durations) if durations else None,
                      "scoredMaxMs": max(durations, default=None), "peakRssKiB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                      "dynamicVsFixed768Delta": abs(first - fixed),
                      "repeatMaxDelta": max(abs(first - score) for score in repeated)}))
    assert abs(first - fixed) <= 1e-5
    assert all(abs(first - score) <= 1e-7 for score in repeated)


if __name__ == "__main__":
    main()
