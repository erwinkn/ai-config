#!/usr/bin/env python3
# /// script
# dependencies = [
#   "google-genai",
#   "pillow",
# ]
# ///
"""Edit an existing image with a text prompt using Gemini API.

Usage:
    op run -- uv run scripts/edit.py input.jpg "Add a sunset to the sky" -o edited.jpg
    op run -- uv run scripts/edit.py photo.png "Make it look like a watercolor painting" --size 2K
"""

import argparse
import os
import sys

from PIL import Image
from google import genai
from google.genai import types


def edit_image(
    input_path: str,
    prompt: str,
    output_path: str = "edited.jpg",
    image_size: str = "1K",
    model: str = "gemini-3-pro-image-preview",
) -> str:
    """Edit an existing image with a text prompt.

    Args:
        input_path: Path to the input image
        prompt: Text description of the edits to make
        output_path: Path to save the edited image (use .jpg extension)
        image_size: Resolution (1K, 2K, or 4K)
        model: Gemini model to use

    Returns:
        Path to the saved image
    """
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    # Load the input image
    input_image = Image.open(input_path)

    config = types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        image_config=types.ImageConfig(
            image_size=image_size,
        ),
    )

    response = client.models.generate_content(
        model=model,
        contents=[prompt, input_image],
        config=config,
    )

    for part in response.parts:
        if part.text:
            print(part.text)
        elif part.inline_data:
            image = part.as_image()
            image.save(output_path)
            print(f"Edited image saved to: {output_path}")
            return output_path

    raise RuntimeError("No image was generated")


def main():
    parser = argparse.ArgumentParser(
        description="Edit an image with a text prompt using Gemini API"
    )
    parser.add_argument("input", help="Path to the input image")
    parser.add_argument("prompt", help="Text description of the edits to make")
    parser.add_argument(
        "-o", "--output",
        default="edited.jpg",
        help="Output file path (default: edited.jpg)"
    )
    parser.add_argument(
        "--size",
        default="1K",
        choices=["1K", "2K", "4K"],
        help="Image resolution (default: 1K)"
    )
    parser.add_argument(
        "--model",
        default="gemini-3-pro-image-preview",
        help="Gemini model to use"
    )

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    try:
        edit_image(
            input_path=args.input,
            prompt=args.prompt,
            output_path=args.output,
            image_size=args.size,
            model=args.model,
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
