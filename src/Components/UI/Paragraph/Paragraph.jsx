export default function Paragraph({ content, color, size, weight, width, textAlign }) {
    return (
        <p
            style={{
                fontSize: size,
                color: color,
                fontWeight: weight,
                width: width,
                textAlign: textAlign,
            }}
            className="text-[black] text-[15px]">
            {content}
        </p>
    )
}