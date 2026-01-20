#!/usr/bin/env python3
# /// script
# dependencies = [
#   "google-genai",
#   "pillow",
# ]
# ///
"""Generate an image from a text prompt using Gemini API.

Usage:
    op run -- uv run scripts/generate.py "Your prompt here" -o output.jpg
    op run -- uv run scripts/generate.py "A sunset over mountains" --aspect 16:9 --size 2K
"""

import argparse
import os
import sys

from google import genai
from google.genai import types


def generate_image(
    prompt: str,
    output_path: str = "output.jpg",
    aspect_ratio: str = "1:1",
    image_size: str = "1K",
    model: str = "gemini-3-pro-image-preview",
) -> str:
    """Generate an image from a text prompt.

    Args:
        prompt: Text description of the image to generate
        output_path: Path to save the generated image (use .jpg extension)
        aspect_ratio: Aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4, etc.)
        image_size: Resolution (1K, 2K, or 4K)
        model: Gemini model to use

    Returns:
        Path to the saved image
    """
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    config = types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        image_config=types.ImageConfig(
            aspect_ratio=aspect_ratio,
            image_size=image_size,
        ),
    )

    response = client.models.generate_content(
        model=model,
        contents=[prompt],
        config=config,
    )

    for part in response.parts:
        if part.text:
            print(part.text)
        elif part.inline_data:
            image = part.as_image()
            image.save(output_path)
            print(f"Image saved to: {output_path}")
            return output_path

    raise RuntimeError("No image was generated")


def main():
    parser = argparse.ArgumentParser(
        description="Generate an image from a text prompt using Gemini API"
    )
    parser.add_argument("prompt", help="Text description of the image to generate")
    parser.add_argument(
        "-o", "--output",
        default="output.jpg",
        help="Output file path (default: output.jpg)"
    )
    parser.add_argument(
        "--aspect",
        default="1:1",
        choices=["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
        help="Aspect ratio (default: 1:1)"
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

    try:
        generate_image(
            prompt=args.prompt,
            output_path=args.output,
            aspect_ratio=args.aspect,
            image_size=args.size,
            model=args.model,
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
