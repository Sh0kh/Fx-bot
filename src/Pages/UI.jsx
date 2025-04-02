import { useState } from "react";
import Button from "../Components/UI/Buttons/Button";
import Input from "../Components/UI/Inputs/Input";
import Select from "../Components/UI/Selects/Select";
import Loading from "../Components/UI/Loadings/Loading";
import Head from "../Components/UI/Head/Head";
import Paragraph from "../Components/UI/Paragraph/Paragraph";
import Text from "../Components/UI/Text/Text";
import Table from "../Components/UI/Table/Table";
import Person from "../Components/UI/Icons/Person";
import Delete from "../Components/UI/Icons/Delete";
import Edit from "../Components/UI/Icons/Edit";
import Delete2 from "../Components/UI/Icons/Delete2";
import Menu from "../Components/UI/Icons/Menu";
import Telegram from "../Components/UI/Icons/Telegram";
import Instagram from "../Components/UI/Icons/Instagram";
import Youtube from "../Components/UI/Icons/Youtube";
import Home from "../Components/UI/Icons/Home";
import Arrow from "../Components/UI/Icons/Arrow";
import File from "../Components/UI/Icons/File";
import Eye from "../Components/UI/Icons/Eye";
import NormalModalEx from "../Components/UI/Modals/Example/NormalModalEx";
import SmallModalEx from "../Components/UI/Modals/Example/SmallModalEx";
import BigModalEx from "../Components/UI/Modals/Example/BigModalEx";
import Accardion from "../Components/UI/Accardion/Accardion";

export default function UI() {
    const [input, setInput] = useState('')
    const [normalModal, setNormalModal] = useState(false)
    const [smallModal, setSmallModal] = useState(false)
    const [bigModal, setBigModal] = useState(false)

    const [selectedOption, setSelectedOption] = useState(null);
    const optionsSelect = [
        { value: "option1", label: "Option 1" },
        { value: "option2", label: "Option 2" },
        { value: "option3", label: "Option 3" },
    ];

    const TableThead = ["Number", "Name", "Price", "Info", "Settings"]
    const TableTbody = [
        {
            Number: 1,
            Name: "Lap top",
            Price: "250 000",
            Info: "Good lap top",
            Settings: ''
        }
    ]

    return (
        <div className="h-screen overflow-hidden overflow-y-auto bg-[black] pt-[30px] pb-[50px]">
            <h1 className="text-center text-[30px] text-[white]">
                Welcome Example UI
            </h1>
            <div className="Container">

                {/* Button */}
                <div className="flex items-center justify-center gap-[100px] mt-[50px]">
                    <h2 className="text-[white]">
                        This is Button
                    </h2>
                    <Button onClick={() => console.log('Ok')} content={"Hello"} />
                </div>

                {/* Input */}
                <div className="flex items-center justify-center gap-[100px] mt-[50px]">
                    <h2 className="text-[white]">
                        This is Input
                    </h2>
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        type={"text"} placeholder={"Example ...."} inputText={"Example"} id={'Example'} />
                </div>

                {/* Select */}

                <div className="flex items-center justify-center gap-[100px] mt-[50px]">
                    <h2 className="text-[white] text-center">
                        This is select
                    </h2>
                    <Select
                        SelectText={"Example..."}
                        options={optionsSelect}
                        value={selectedOption}
                        onChange={setSelectedOption}
                    />
                </div>

                <div className="flex items-center justify-center mt-[50px]">
                    <div>
                        <h2 className="text-[white] text-center">
                            This is Loading
                        </h2>
                        <Loading />
                    </div>
                </div>


                {/* Head */}
                <div className="flex items-center justify-center gap-[100px] mt-[50px]">
                    <h2 className="text-[white]">
                        This is Head
                    </h2>

                    <Head number={1} textAlign={'right'} content={'Head'} weight={'normal'} color={'white'} size={'50px'} />
                </div>
                <div className="flex items-center justify-center gap-[100px] mt-[50px]">
                    <h2 className="text-[white]">
                        This is Paragraph
                    </h2>
                    <Paragraph
                        width={'500px'}
                        weight={'normal'}
                        size={'15px'}
                        color={'white'}
                        textAlign={'right'}
                        content={'Lorem ipsum dolor sit amet consectetur adipisicing elit. Dignissimos quos harum veritatis amet tempore commodi quidem perferendis ratione, quo illo nihil obcaecati eos, alias sit eius delectus eveniet odio cupiditate.'} />
                </div>
                <div className="flex items-center justify-center gap-[100px] mt-[50px]">
                    <h2 className="text-[white]">
                        This is Text
                    </h2>
                    <Text
                        textAlign={'right'}
                        content={'Text'}
                        weight={'normal'}
                        color={'white'}
                        size={'20px'}
                    />
                </div>

                <div className="flex items-center justify-center mt-[50px] w-[100%]">
                    <div className="w-full">
                        <h2 className="text-[white] text-center mb-[20px] block">
                            This is Table
                        </h2>
                        <Table
                            theadColor={'white'}
                            thead={TableThead}
                            tbody={TableTbody}
                            pagapagination={true}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-center mt-[50px] w-[100%]">
                    <div className="w-full">
                        <h2 className="text-[white] text-center">
                            This is icons
                        </h2>
                        <div className="flex items-center justify-between mt-[20px] w-[100%]">
                            <Person color={'white'} size={"50px"} />
                            <Delete color={'white'} size={"50px"} />
                            <Edit color={'white'} size={"50px"} />
                            <Delete2 color={'white'} size={"50px"} />
                            <Menu color={'white'} size={"50px"} />
                            <Telegram color={'white'} size={"50px"} />
                            <Instagram color={'white'} size={"50px"} />
                            <Youtube color={'white'} size={"50px"} />
                            <Home color={'white'} size={"50px"} />
                            <Arrow rotate={'180deg'} color={'white'} size={"50px"} />
                            <File color={'white'} size={"50px"} />
                            <Eye color={'white'} size={"50px"} />
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-center mt-[50px] w-[100%]">
                    <div className="w-full">
                        <h2 className="text-[white] text-center">
                            This is Moldals
                        </h2>
                        <div className="flex items-center justify-between mt-[20px] w-[100%]">
                            <Button onClick={() => setSmallModal(true)} content={"Small modal"} />
                            <Button onClick={() => setNormalModal(true)} content={"Normal modal"} />
                            <Button onClick={() => setBigModal(true)} content={"Big modal"} />
                        </div>
                        <NormalModalEx isOpen={normalModal} onClose={() => setNormalModal(false)} />
                        <SmallModalEx isOpen={smallModal} onClose={() => setSmallModal(false)} />
                        <BigModalEx isOpen={bigModal} onClose={() => setBigModal(false)} />
                    </div>
                </div>

                <div className="flex items-center justify-center mt-[50px] w-[100%]">
                    <div className="w-full">
                        <h2 className="text-[white] text-center">
                            This is Accardion
                        </h2>
                        <div className="flex items-center justify-between mt-[20px] w-[100%]">
                            <Accardion icon={true} head={"Accardion"} body={'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Maxime accusantium dolor adipisci consequuntur debitis. Consequatur eaque sit cum dolor perferendis.'}/>
                            
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}