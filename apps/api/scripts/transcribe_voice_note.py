#!/usr/bin/env python3
import argparse
import json
import os
import sys
import traceback


def emit(payload):
    print(
        json.dumps(
            payload,
            ensure_ascii=False,
        ),
        flush=True,
    )


def main():
    parser = argparse.ArgumentParser(
        description="Transcribe a task voice note with local faster-whisper."
    )
    parser.add_argument(
        "--audio",
        required=True,
    )
    parser.add_argument(
        "--model",
        default="small",
    )
    parser.add_argument(
        "--device",
        default="cpu",
    )
    parser.add_argument(
        "--compute-type",
        default="int8",
    )
    parser.add_argument(
        "--model-dir",
        required=True,
    )
    parser.add_argument(
        "--language",
        choices=["gu", "hi", "en"],
        default=None,
    )
    args = parser.parse_args()

    if not os.path.isfile(args.audio):
        raise FileNotFoundError(
            f"Audio file not found: {args.audio}"
        )

    os.makedirs(
        args.model_dir,
        exist_ok=True,
    )

    from faster_whisper import WhisperModel

    model = WhisperModel(
        args.model,
        device=args.device,
        compute_type=args.compute_type,
        download_root=args.model_dir,
    )

    segments, info = model.transcribe(
        args.audio,
        beam_size=5,
        language=args.language,
        vad_filter=True,
        vad_parameters={
            "min_silence_duration_ms": 500,
        },
    )

    text_parts = []

    for segment in segments:
        value = (
            segment.text or ""
        ).strip()

        if value:
            text_parts.append(
                value
            )

    transcript = " ".join(
        text_parts
    ).strip()

    emit(
        {
            "text": transcript,
            "language": getattr(
                info,
                "language",
                None,
            ),
            "languageProbability": getattr(
                info,
                "language_probability",
                None,
            ),
            "durationSeconds": getattr(
                info,
                "duration",
                None,
            ),
            "model": args.model,
        }
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(
            f"{type(exc).__name__}: {exc}",
            file=sys.stderr,
            flush=True,
        )
        traceback.print_exc(
            file=sys.stderr,
        )
        sys.exit(1)
