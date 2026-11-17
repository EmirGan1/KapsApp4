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
    durations = {"english": [], "turkish": []}
    counts = {label: {"scored": 0, "skipped": 0, "wrongAt0_5": 0, "mixed": 0, "wrongReportedSignal": 0}
              for label in ("english:human", "english:ai", "turkish:human", "turkish:ai")}
    for record in samples:
        if record.get("label") not in ("human", "ai", "edited") or not record.get("source"):
            raise ValueError("Each sample needs a verified label and source")
        text = record["text"]
        start = clock()
        result = detector.analyze(text)
        duration = round((clock() - start) * 1000)
        scores = result["scores"]
        segments = result["segmentAi"]
        summary = {"id": record["id"], "label": record["label"], "language": result["language"],
                   "words": result["words"], "tokens": result["tokens"], "ms": duration}
        if scores is not None:
            durations[result["language"]].append(duration)
            turkish = result["language"] == "turkish"
            ai_signal = all(x > 0.95 if turkish else x >= 0.5 for x in segments)
            human_signal = all(x < (0.48 if turkish else 0.5) for x in segments)
            vote = "mixed"
            if ai_signal:
                vote = "ai"
            elif human_signal:
                vote = "human"
            summary.update(ai=scores[1], segments=segments, vote=vote)
        label = record["label"]
        key = result["language"] + ":" + label
        if key in counts:
            bucket = counts[key]
            if scores is None:
                bucket["skipped"] += 1
            else:
                bucket["scored"] += 1
                bucket["wrongAt0_5"] += int((scores[1] >= 0.5) != (label == "ai"))
                bucket["mixed"] += int(vote == "mixed")
                bucket["wrongReportedSignal"] += int(vote not in (label, "mixed"))
        print(json.dumps(summary), flush=True)

    for language in ("english", "turkish"):
        human = counts[language + ":human"]
        ai = counts[language + ":ai"]
        print(json.dumps({
            "language": language,
            "human": human, "ai": ai,
            "falsePositiveRate": human["wrongReportedSignal"] / human["scored"] if human["scored"] else None,
            "falseNegativeRate": ai["wrongReportedSignal"] / ai["scored"] if ai["scored"] else None,
            "inconclusiveHuman": human["mixed"], "inconclusiveAi": ai["mixed"],
            "scoredMedianMs": statistics.median(durations[language]) if durations[language] else None,
            "scoredMaxMs": max(durations[language], default=None),
            "peakRssKiB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        }), flush=True)


if __name__ == "__main__":
    main()
