export default function Text({ size, color, weight, content, textAlign }) {
    return (
        <span
            style={{
                fontSize: size,
                color: color,
                fontWeight: weight,
                textAlign: textAlign,
            }}
            className="block text-[black] text-[15px]"
        >
            {content}
        </span>
    )
}