import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    const replicate = new Replicate();

    const input = {
      img: imageUrl,
    };

    console.log("Enhancing image:", imageUrl);

    const output = await replicate.run(
      "tencentarc/gfpgan:0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c",
      { input }
    );

    console.log("Replicate output:", output);

    // The output is a file object with a url() method
    const enhancedImageUrl = output && typeof output === 'object' && 'url' in output
      ? (output as any).url()
      : output;

    if (!enhancedImageUrl) {
      return NextResponse.json(
        { error: "Failed to enhance image - no output received" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      imageUrl: typeof enhancedImageUrl === 'string' ? enhancedImageUrl : enhancedImageUrl.toString()
    });
  } catch (error) {
    console.error("Error enhancing image:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to enhance image: ${errorMessage}` },
      { status: 500 }
    );
  }
}

