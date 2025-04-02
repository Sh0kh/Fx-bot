import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export default function Accardion({ head, body, icon }) {
    return (
        <Accordion sx={{ width: "100%" }}>
            <AccordionSummary expandIcon={icon ? <ExpandMoreIcon /> : null}>
                <Typography>{head}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Typography>{body}</Typography>
            </AccordionDetails>
        </Accordion>
    );
}
