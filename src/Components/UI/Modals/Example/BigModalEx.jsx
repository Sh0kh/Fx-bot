import Head from "../../Head/Head";
import BigModal from "../BigModal";

export default function BigModalEx({ isOpen, onClose }) {
    return (
        <BigModal isOpen={isOpen} onClose={onClose}>
            <div className="flex items-center justify-center">
                <Head number={1} size={'20px'} weight={'bold'} content={"This is Big modal"} />
            </div>
        </BigModal>
    )
}