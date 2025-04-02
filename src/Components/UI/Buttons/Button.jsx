export default function Button({ content, onClick }) {

    return (
        <button onClick={onClick}
            className="px-[30px] py-[5px] border-[2px] border-[white] bg-[white] rounded-[5px] transition duration-300 hover:text-[white] hover:bg-transparent">
            {content}
        </button>
    )
}