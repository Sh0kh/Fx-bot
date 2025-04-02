import '../../Style/Modals/NormalModal.css'

export default function NormalModal({ isOpen, onClose, children }) {
    return (
        <div className={`NormalModal ${isOpen ? "open" : ""}`} onClick={onClose} >
            <div className={`NormalModalContent ${isOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    )
}