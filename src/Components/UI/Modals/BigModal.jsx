import '../../Style/Modals/BigModal.css'

export default function BigModal({ isOpen, onClose, children }) {
    return (
        <div className={`BigModal ${isOpen ? "open" : ""}`} onClick={onClose} >
            <div className={`BigModalContent ${isOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    )
}