import ReactLoading from 'react-loading';

export default function Loading() {
    return (
        <div className="flex items-center justify-between gap-[30px]">
            <div className="flex items-center justify-center">
                <ReactLoading type="balls" color="white" height={80} width={80} />
            </div>
            <div className="flex items-center justify-center">
                <ReactLoading type="bars" color="white" height={80} width={80} />
            </div>
            <div className="flex items-center justify-center">
                <ReactLoading type="bubbles" color="white" height={80} width={80} />
            </div>
            <div className="flex items-center justify-center">
                <ReactLoading type="cubes" color="white" height={80} width={80} />
            </div>
            <div className="flex items-center justify-center">
                <ReactLoading type="cylon" color="white" height={80} width={80} />
            </div>
            <div className="flex items-center justify-center">
                <ReactLoading type="spin" color="white" height={80} width={80} />
            </div>
            <div className="flex items-center justify-center">
                <ReactLoading type="spinningBubbles" color="white" height={80} width={80} />
            </div>
            <div className="flex items-center justify-center">
                <ReactLoading type="spokes" color="white" height={80} width={80} />
            </div>
        </div>
    );
}
