#!/usr/bin/env python3
# /// script
# dependencies = [
#   "google-genai",
#   "pillow",
# ]
# ///
"""Compose multiple images with a text prompt using Gemini API.

Usage:
    op run -- uv run scripts/compose.py "Create a collage of these photos" img1.jpg img2.jpg -o composed.jpg
    op run -- uv run scripts/compose.py "Put these people in an office setting" person1.png person2.png person3.png --aspect 16:9
"""

import argparse
import os
import sys

from PIL import Image
from google import genai
from google.genai import types


def compose_images(
    prompt: str,
    input_paths: list[str],
    output_path: str = "composed.jpg",
    aspect_ratio: str = "1:1",
    image_size: str = "1K",
    model: str = "gemini-3-pro-image-preview",
) -> str:
    """Compose multiple images with a text prompt.

    Args:
        prompt: Text description of how to compose the images
        input_paths: List of paths to input images (up to 14)
        output_path: Path to save the composed image (use .jpg extension)
        aspect_ratio: Aspect ratio for the output
        image_size: Resolution (1K, 2K, or 4K)
        model: Gemini model to use

    Returns:
        Path to the saved image
    """
    if len(input_paths) > 14:
        raise ValueError("Maximum 14 input images allowed")

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    # Load all input images
    images = [Image.open(path) for path in input_paths]

    # Build contents: prompt followed by all images
    contents = [prompt] + images

    config = types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        image_config=types.ImageConfig(
            aspect_ratio=aspect_ratio,
            image_size=image_size,
        ),
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=config,
    )

    for part in response.parts:
        if part.text:
            print(part.text)
        elif part.inline_data:
            image = part.as_image()
            image.save(output_path)
            print(f"Composed image saved to: {output_path}")
            return output_path

    raise RuntimeError("No image was generated")


def main():
    parser = argparse.ArgumentParser(
        description="Compose multiple images with a text prompt using Gemini API"
    )
    parser.add_argument("prompt", help="Text description of how to compose the images")
    parser.add_argument(
        "inputs",
        nargs="+",
        help="Paths to input images (up to 14)"
    )
    parser.add_argument(
        "-o", "--output",
        default="composed.jpg",
        help="Output file path (default: composed.jpg)"
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

    # Validate input files exist
    for path in args.inputs:
        if not os.path.exists(path):
            print(f"Error: Input file not found: {path}", file=sys.stderr)
            sys.exit(1)

    if len(args.inputs) > 14:
        print("Error: Maximum 14 input images allowed", file=sys.stderr)
        sys.exit(1)

    try:
        compose_images(
            prompt=args.prompt,
            input_paths=args.inputs,
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
