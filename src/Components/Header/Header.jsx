import { NavLink } from "react-router-dom";

export default function Header() {
    return (
        <header>
            <div className="Container">
                <div className="flex items-center flex-wrap gap-[10px] mt-[10px]">
                    <NavLink className={'bg-blue-500 text-white px-3 py-2 rounded-sm'} to={'/crypto'}>
                        Криптотрейдинг
                    </NavLink>
                    <NavLink className={'bg-blue-500 text-white px-3 py-2 rounded-sm'} to={'/'}>
                        Форекс трейдинг
                    </NavLink>
                </div>
            </div>
        </header>
    )
}