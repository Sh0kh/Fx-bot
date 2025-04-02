import Selects from "react-select";

export default function Select({ id, SelectText, placeholder, value, options, onChange }) {
    const customStyles = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: "white",
            width: '200px',
            borderColor: state.isFocused ? "black " : "white",
            color: "white",
            padding: "5px",
            boxShadow: state.isFocused ? "black" : "white",
            "&:hover": {
                borderColor: "lightblue",
            },
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: "white",
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected ? "yellow" : "white",
            color: "black",
            "&:hover": {
                backgroundColor: "red",
            },
        }),
        singleValue: (provided) => ({
            ...provided,
            color: "black",
        }),
    };

    return (
        <label htmlFor={id}>
            <span className="text-[white] block text-[12px] cursor-pointer">
                {SelectText}
            </span>
            <Selects
                options={options}
                placeholder={placeholder}
                id={id}
                value={value}
                onChange={onChange}
                isClearable={true}
                styles={customStyles}
            />
        </label>
    );
}
