// Renders a .usdz with RealityKit, the engine of Quick Look on iPhone, iPad and Vision Pro, shut or with every part
// open the way a tap leaves it (each part's _Open copy at its PoseOpen, the shut copy parked, the locks of parts inside
// others open). The gate's apple-render uses SceneKit; this is what Quick Look itself draws. Studio light: env/studio.hdr
// as image-based light when it loads, plus a key and a fill light. It also prints how many entities show (scale over
// half) and any part showing twice or not at all.
// usage: rk_render <file.usdz> <out.png> [closed|open] [yaw degrees, default -28] [px, default 900] [studio.hdr]
//        [camera height over the size, default 0.2]
import AppKit
import Foundation
import Metal
import RealityKit

let args = CommandLine.arguments
let url = URL(fileURLWithPath: args[1])
let out = URL(fileURLWithPath: args[2])
let open = args.count > 3 && args[3] == "open"
let yaw = Float(args.count > 4 ? Double(args[4])! : -28) * .pi / 180
let px = args.count > 5 ? Int(args[5])! : 900
let hdr = args.count > 6 && args[6] != "-" ? args[6] : nil
let lift = Float(args.count > 7 ? Double(args[7])! : 0.2)
let sem = DispatchSemaphore(value: 0)
Task { @MainActor in
  do {
    let root = try await Entity(contentsOf: url)
    var byName: [String: [Entity]] = [:]
    func walk(_ e: Entity) { byName[e.name, default: []].append(e); e.children.forEach(walk) }
    walk(root)
    var parts = 0
    if open {
      for (name, list) in byName where name.hasSuffix("_Open") {
        let base = String(name.dropLast(5))
        for o in list {
          guard let parent = o.parent else { continue }
          if let pose = parent.children.first(where: { $0.name == "\(base)_PoseOpen" }) { o.transform = pose.transform; parts += 1 }
          if let shut = parent.children.first(where: { $0.name == base }), let park = parent.children.first(where: { $0.name == "\(base)_PoseParked" }) { shut.transform = park.transform }
        }
      }
      // the locks of parts inside others: open, so their keys are where a tap would find them
      for (name, list) in byName where name.contains("_Gate_") && !name.hasSuffix("On") && !name.hasSuffix("Off") { for g in list { g.scale = [1, 1, 1] } }
    }
    // a part shows once: its shut copy or its open copy at full size, never both or neither
    func worldScale(_ e: Entity) -> Float { var s: Float = 1; var c: Entity? = e; while let x = c { s *= max(x.scale.x, x.scale.y, x.scale.z); c = x.parent }; return s }
    var faults: [String] = []
    for (name, list) in byName where name.hasSuffix("_Open") {
      let base = String(name.dropLast(5))
      for o in list {
        guard let shut = o.parent?.children.first(where: { $0.name == base }) else { continue }
        let n = [o, shut].filter { worldScale($0) > 0.5 * worldScale(o.parent!) }.count
        if n != 1 { faults.append("\(base): \(n == 0 ? "not showing" : "showing twice")") }
      }
    }
    print("parts opened:", parts, faults.isEmpty ? "each part shows once" : "FAULTS: " + faults.joined(separator: ", "))

    let renderer = try RealityRenderer()
    let anchor = Entity()
    anchor.addChild(root)
    renderer.entities.append(anchor)
    if let hdr, let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: hdr) as CFURL, nil), let img = CGImageSourceCreateImageAtIndex(src, 0, nil) {
      if let env = try? await EnvironmentResource(equirectangular: img) {
        renderer.lighting.resource = env
        print("light: studio image")
      }
    }
    let bounds = root.visualBounds(relativeTo: nil)
    let size = max(bounds.extents.x, bounds.extents.y, bounds.extents.z)
    let cam = PerspectiveCamera()
    cam.camera.fieldOfViewInDegrees = 30
    let dist = size * 2.3
    let target = bounds.center
    cam.position = target + SIMD3(sin(yaw) * dist, size * lift, cos(yaw) * dist)
    cam.look(at: target, from: cam.position, relativeTo: nil)
    renderer.entities.append(cam)
    renderer.activeCamera = cam
    let key = DirectionalLight()
    key.light.intensity = 2200
    key.look(at: .zero, from: SIMD3(-1.5, 2, 2), relativeTo: nil)
    renderer.entities.append(key)
    let fill = DirectionalLight()
    fill.light.intensity = 900
    fill.look(at: .zero, from: SIMD3(2, 0.5, 1.5), relativeTo: nil)
    renderer.entities.append(fill)
    let device = MTLCreateSystemDefaultDevice()!
    let desc = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm_srgb, width: px, height: px, mipmapped: false)
    desc.usage = [.renderTarget, .shaderRead]
    desc.storageMode = .shared
    let tex = device.makeTexture(descriptor: desc)!
    // a few frames, so textures have streamed in
    for _ in 0..<3 {
      let done = DispatchSemaphore(value: 0)
      try renderer.updateAndRender(deltaTime: 0.016, cameraOutput: .init(.singleProjection(colorTexture: tex)), onComplete: { _ in done.signal() })
      while done.wait(timeout: .now() + 0.05) == .timedOut { RunLoop.main.run(until: Date() + 0.05) }
    }
    var bytes = [UInt8](repeating: 0, count: px * px * 4)
    tex.getBytes(&bytes, bytesPerRow: px * 4, from: MTLRegionMake2D(0, 0, px, px), mipmapLevel: 0)
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: px * 4, bitsPerPixel: 32)!
    // BGRA to RGBA, over a light grey card (the render's clear background is transparent)
    for i in stride(from: 0, to: bytes.count, by: 4) {
      bytes.swapAt(i, i + 2)
      let a = Float(bytes[i + 3]) / 255
      for k in 0..<3 { bytes[i + k] = UInt8(min(255, Float(bytes[i + k]) + (1 - a) * 226)) }
      bytes[i + 3] = 255
    }
    memcpy(rep.bitmapData!, bytes, bytes.count)
    try rep.representation(using: .png, properties: [:])!.write(to: out)
    print("wrote", out.path)
  } catch { print("FAILED", error) }
  sem.signal()
}
while sem.wait(timeout: .now() + 0.05) == .timedOut { RunLoop.main.run(until: Date() + 0.05) }
