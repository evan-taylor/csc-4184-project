"use client"
import  "./page.css"
import {useState, Suspense} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

type Activity = {
    name: string;
    selected: boolean;
}

function AddActivityButton({ title, onClick }: {title : string; onClick?: () => void}){
    return (
        <button className="planner-button" onClick={onClick} disabled={!onClick}>
             {title}
        </button>
    );
}

function CountActivity(i : number, 
                        setActivities: React.Dispatch<React.SetStateAction<Activity[]>>
){
    setActivities(prev => prev.map((activity, j) => {
    if (j === i){
        return { ...activity, selected: !activity.selected};
    }
    return activity;
    }));
}

function SetTime(activities: Activity[], router: ReturnType<typeof useRouter>){
    const selectedActivities = activities.filter( activity => activity.selected);
    sessionStorage.setItem("selectedActivities", JSON.stringify(selectedActivities));
    router.push("/add-time")
}

function PlanEvening(){

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

    const selectedCount = activities.filter(activity => activity.selected).length;

    const router = useRouter();

    const searchParams = useSearchParams();

    const selectedDate = searchParams.get("date");

    return (
        <main className="planner-page evening-planner">
            <Link className="calendar-back" href="/">Back to Calendar</Link>
            <div className="subtitle">
                <h2> Choose Activities</h2>
            </div>

            <div className="activity-list">
                {activities.map((activity, index) => (
                    <label className="activity" key={index}>
                        <input type="checkbox" checked={activity.selected} onChange={() => CountActivity(index, setActivities)} />
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

                        <button className="planner-button" onClick={AddActivity}>
                            Add
                        </button>

                        <button className="planner-button" onClick={() => setShowPopup(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}


            <AddActivityButton title="+ Add Another Activity" onClick={() => setShowPopup(true)}/>

            <div className="subtitle">
                <h2> {selectedCount} Activities Selected </h2>
            </div>
            
            <AddActivityButton title="Set Time ->" onClick={() => SetTime(activities, router)}/> 

        </main>
    )
}


export default function Page() {
    return (
        <Suspense fallback={<p>Loading...</p>}>
            <PlanEvening />
        </Suspense>
    );
}
