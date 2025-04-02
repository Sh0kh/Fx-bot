import Head from "../../Head/Head";
import SmallModal from "../SmallModal";

export default function SmallModalEx({ isOpen, onClose }) {
    return (
        <SmallModal isOpen={isOpen} onClose={onClose}>
            <div className="flex items-center justify-center">
                <Head number={1} size={'20px'} weight={'bold'} content={"This is Small   modal"}/>
            </div>
        </SmallModal>
    )
}