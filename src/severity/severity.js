import { MM_PER_PIXEL } from "./calibration.js";

export function calculateSeverity(detection, imageWidth, imageHeight) {
    const bbox = detection.bbox;

    const widthPx = bbox.width;
    const heightPx = bbox.height;

    const estimatedLengthMM = widthPx * MM_PER_PIXEL;

    const imageArea = imageWidth * imageHeight;
    const bboxArea = widthPx * heightPx;

    const areaRatio = bboxArea / imageArea;

    const areaScore = Math.min(areaRatio * 10000, 100);

    const aspectRatio = widthPx / heightPx;

    let shapeScore = 0;

    if (aspectRatio >= 5) {
        shapeScore = 100;
    } else if (aspectRatio >= 3) {
        shapeScore = 70;
    } else {
        shapeScore = 40;
    }

    const lengthScore = Math.min(
        (estimatedLengthMM / 5) * 100,
        100
    );

    const severityScore = Math.round(
        0.6 * lengthScore +
        0.2 * areaScore +
        0.2 * shapeScore
    );

    return {
        estimatedLengthMM: Number(
            estimatedLengthMM.toFixed(2)
        ),
        severityScore
    };
}