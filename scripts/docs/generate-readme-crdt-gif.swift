import AVFoundation
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data("\(message)\n".utf8))
  exit(1)
}

guard CommandLine.arguments.count == 3 else {
  fail("Usage: swift scripts/docs/generate-readme-crdt-gif.swift <input.mp4> <output.gif>")
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let asset = AVURLAsset(url: inputURL)
let duration = CMTimeGetSeconds(asset.duration)
guard duration.isFinite, duration > 0 else {
  fail("The input video has no readable duration")
}

let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero

let framesPerSecond = 5.0
let frameCount = max(2, Int(ceil(duration * framesPerSecond)))
let firstFrame: CGImage
do {
  firstFrame = try generator.copyCGImage(at: .zero, actualTime: nil)
} catch {
  fail("Unable to read the first video frame: \(error)")
}

guard firstFrame.width == 2560, firstFrame.height == 2000 else {
  fail("Expected a 2560x2000 CRDT recording, received \(firstFrame.width)x\(firstFrame.height)")
}

let outputWidth = 800
let outputHeight = Int(
  round(Double(outputWidth) * Double(firstFrame.height) / Double(firstFrame.width))
)

guard
  let destination = CGImageDestinationCreateWithURL(
    outputURL as CFURL,
    UTType.gif.identifier as CFString,
    frameCount,
    nil
  )
else {
  fail("Unable to create the GIF destination")
}

CGImageDestinationSetProperties(
  destination,
  [
    kCGImagePropertyGIFDictionary: [
      kCGImagePropertyGIFLoopCount: 0
    ]
  ] as CFDictionary
)

let frameProperties = [
  kCGImagePropertyGIFDictionary: [
    kCGImagePropertyGIFDelayTime: 1.0 / framesPerSecond,
    kCGImagePropertyGIFUnclampedDelayTime: 1.0 / framesPerSecond
  ]
] as CFDictionary

for index in 0..<frameCount {
  let seconds = min(Double(index) / framesPerSecond, duration - 0.001)
  let time = CMTime(seconds: seconds, preferredTimescale: 600)
  let sourceFrame: CGImage
  do {
    sourceFrame = try generator.copyCGImage(at: time, actualTime: nil)
  } catch {
    fail("Unable to read video frame \(index): \(error)")
  }

  guard let context = CGContext(
      data: nil,
      width: outputWidth,
      height: outputHeight,
      bitsPerComponent: 8,
      bytesPerRow: 0,
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else {
    fail("Unable to compose video frame \(index)")
  }

  context.interpolationQuality = .medium
  context.draw(
    sourceFrame,
    in: CGRect(x: 0, y: 0, width: outputWidth, height: outputHeight)
  )

  guard let frame = context.makeImage() else {
    fail("Unable to finalize video frame \(index)")
  }
  CGImageDestinationAddImage(destination, frame, frameProperties)
}

guard CGImageDestinationFinalize(destination) else {
  fail("Unable to finalize the GIF")
}

let formattedDuration = String(format: "%.2f", duration)
print(
  "Generated \(frameCount) frames at \(outputWidth)x\(outputHeight) from \(formattedDuration) seconds"
)
