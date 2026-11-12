import  "./page.css"

export function AddActivityButton({ title }: {title : string }){
    return (
        <button className="button"> {title} </button>
    );
}

export default function PlanEvening(){
    return (
        <>
            <AddActivityButton title="Plan Evening" />
            <AddActivityButton title="Set Time" />
        </>
    )
}