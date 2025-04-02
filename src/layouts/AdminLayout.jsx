import { Outlet } from "react-router-dom";

export default function AdminLayout(){
    return(
        <div className="flex w-[100%] overflow-hidden">
            <Outlet/>
        </div>
    )
}