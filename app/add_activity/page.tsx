"use client"
import  "./page.css"
import {useState} from "react";

export function AddActivityButton({ title, onClick }: {title : string; onClick: () => void}){
    return (
        <button className="button" onClick={onClick}>
             {title}
        </button>
    );
}


export default function PlanEvening(){

    function AddActivity(){
        
        if (name){
            setActivities([
                ...activities, {name, selected: false}
            ]);
        }
        setName("");
        setShowPopup(false);
    }

    const[activities, setActivities] = useState([
        { name: "Walk", selected: false},
        { name: "Dinner", selected: false},
        { name: "Reading", selected: false}
    ]);

    const [name, setName] = useState("");

    const [showPopup, setShowPopup] = useState(false);

    return (
        <>
            <div className="subtitle">
                <h2> Choose Activities</h2>
            </div>

            <div className="activity-list">
                {activities.map((activity, index) => (
                    <label className="activity" key={index}>
                        <input type="checkbox" />
                        {activity.name}
                    </label>
                ))}
            </div>

            {showPopup && (
                <div className="popup-background">
                    <div className="popup">
                        <h3>Add Activity</h3>

                        <input
                            type="text"
                            placeholder="Enter Activity Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />

                        <button onClick={AddActivity}>
                            Add
                        </button>

                        <button onClick={() => setShowPopup(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}


            <AddActivityButton title="+ Add Another Activity" onClick={() => setShowPopup(true)}/>

            <div className="subtitle">
                <h2>Activities Selected </h2>
            </div>
            <AddActivityButton title="Set Time ->" onClick={() => {}}/>

        </>
    )
}



