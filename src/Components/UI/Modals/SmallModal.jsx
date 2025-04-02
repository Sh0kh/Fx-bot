import '../../Style/Modals/SmallModal.css'

export default function SmallModal({ isOpen, onClose, children }) {
    return (
        <div className={`SmallModal ${isOpen ? "open" : ""}`} onClick={onClose} >
            <div className={`SmallModalContent ${isOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    )
}