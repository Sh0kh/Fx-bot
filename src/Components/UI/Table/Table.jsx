export default function Table({ theadColor, thead, tbody, pagapagination }) {
    return (
        <>
            <div className="overflow-x-auto w-[100%]">
                <table className=" border-collapse border border-gray-300 w-full min-w-[500px]">
                    <thead>
                        <tr>
                            {thead?.map((header, index) => (
                                <th key={index} className="px-4 py-2 border" style={{ color: theadColor }}>
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tbody?.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {thead.map((key, cellIndex) => (
                                    <td
                                        style={{ color: theadColor }}
                                        key={cellIndex} className="px-4 py-2 border text-center">
                                        {row[key] ?? ""}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {pagapagination === true && (
                <div className='w-full mt-[20px]' style={{ color: theadColor }}>
                    <div className='flex items-center gap-[10px]'>
                        <button
                            className={`p-2 rounded-full text-[20px] border-2  cursor-pointer`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 15 15">
                                <path fill="none" stroke="currentColor" strokeLinecap="square" d="M10 14L3 7.5L10 1"></path>
                            </svg>
                        </button>
                        <div
                            className="px-[15px] py-[6px]  border-[2px] rounded-[50%] ">
                            1
                        </div>
                        <button
                            className={`p-2 rounded-full text-[20px] border-2  `}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 15 15">
                                <path fill="none" stroke="currentColor" strokeLinecap="square" d="m5 14l7-6.5L5 1"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}