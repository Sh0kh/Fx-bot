import { GrTextAlignCenter } from "react-icons/gr";

export default function Head({ size, color, weight, content, number, textAlign }) {
    const Tag = `h${number >= 1 && number <= 6 ? number : 2}`;

    return (
        <Tag
            style={{
                fontSize: size,
                color: color,
                fontWeight: weight,
                textAlign: textAlign,
            }}
        >
            {content}
        </Tag>
    );
}
