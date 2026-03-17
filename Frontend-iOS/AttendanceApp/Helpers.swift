import SwiftUI

struct CornerShape: Shape {
    var radius: CGFloat
    var corners: [Corner]
    enum Corner { case topLeft, topRight, bottomLeft, bottomRight }

    func path(in rect: CGRect) -> Path {
        var p = Path()
        let r = radius
        let tl = corners.contains(.topLeft),  tr = corners.contains(.topRight)
        let bl = corners.contains(.bottomLeft), br = corners.contains(.bottomRight)
        p.move(to: CGPoint(x: rect.minX + (tl ? r : 0), y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX - (tr ? r : 0), y: rect.minY))
        if tr { p.addArc(center: CGPoint(x: rect.maxX-r, y: rect.minY+r), radius: r, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false) }
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - (br ? r : 0)))
        if br { p.addArc(center: CGPoint(x: rect.maxX-r, y: rect.maxY-r), radius: r, startAngle: .degrees(0), endAngle: .degrees(90), clockwise: false) }
        p.addLine(to: CGPoint(x: rect.minX + (bl ? r : 0), y: rect.maxY))
        if bl { p.addArc(center: CGPoint(x: rect.minX+r, y: rect.maxY-r), radius: r, startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false) }
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY + (tl ? r : 0)))
        if tl { p.addArc(center: CGPoint(x: rect.minX+r, y: rect.minY+r), radius: r, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false) }
        p.closeSubpath()
        return p
    }
}
