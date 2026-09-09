#!/usr/bin/env python3
import os
from pathlib import Path

from faster_whisper import WhisperModel


def main():
    api_root = Path(
        __file__
    ).resolve().parent.parent

    model_dir = (
        api_root
        / "storage"
        / "whisper-models"
    )

    model_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    model_name = os.getenv(
        "WHISPER_MODEL",
        "small",
    )

    device = os.getenv(
        "WHISPER_DEVICE",
        "cpu",
    )

    compute_type = os.getenv(
        "WHISPER_COMPUTE_TYPE",
        "int8",
    )

    print(
        f"Preparing local Whisper model: {model_name}"
    )
    print(
        f"Model cache: {model_dir}"
    )
    print(
        "First run may download the model. This is free and is only needed once."
    )

    WhisperModel(
        model_name,
        device=device,
        compute_type=compute_type,
        download_root=str(
            model_dir
        ),
    )

    print(
        "LOCAL WHISPER MODEL READY"
    )


if __name__ == "__main__":
    main()
