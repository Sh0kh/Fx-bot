export default function Input({ id, type, placeholder, inputText, value, onChange }) {
    return (
        <label htmlFor={id} className="">
            <span className="text-[white] block text-[12px] cursor-pointer">
                {inputText}
            </span>
            <input
                className="py-[5px] px-[10px] rounded-[5px] outline-none text-[black] bg-[white]"
                placeholder={placeholder}
                type={type}
                id={id}
                value={value}
                onChange={onChange} />
        </label>
    )
}