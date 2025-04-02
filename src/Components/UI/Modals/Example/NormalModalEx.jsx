import Head from "../../Head/Head";
import NormalModal from "../NormalModal";

export default function NormalModalEx({ isOpen, onClose }) {
    return (
        <NormalModal isOpen={isOpen} onClose={onClose}>
            <div className="flex items-center justify-center">
                <Head number={1} size={'20px'} weight={'bold'} content={"This is Normal modal"}/>
            </div>
        </NormalModal>
    )
}