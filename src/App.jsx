import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ==========================
// Storage & Utilities
// ==========================
const STORAGE_KEY_V2 = "taskCounter.tasks.v2"; // [{id,name,archived,events:[{iso,qty}]}]
const LEGACY_EVENTS_KEY = "taskCounter.events.v1";
const LEGACY_NAME_KEY = "taskCounter.taskName";

const COLORS = ["#4f46e5","#16a34a","#dc2626","#0891b2","#a855f7","#f59e0b","#0ea5e9","#d946ef","#10b981","#f97316"];

const uid = () => Math.random().toString(36).slice(2, 10);

function formatDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function toISOAtNoonLocal(dateKey) {
  const [y,m,d]=dateKey.split("-").map(Number);
  return new Date(y,m-1,d,12,0,0,0).toISOString();
}
function* daysBack(n,endDate=new Date()){
  const d=new Date(endDate);d.setHours(0,0,0,0);
  for(let i=n-1;i>=0;i--){const x=new Date(d);x.setDate(d.getDate()-i);yield x;}
}
function download(filename,text){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"application/json"}));a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);}

// ==========================
export default function TaskCounterApp(){
  const fileInputRef=useRef(null);
  const [tasks,setTasks]=useState(() => {
    try{
      const raw=localStorage.getItem(STORAGE_KEY_V2);
      if(raw) return JSON.parse(raw);
      const legacy=JSON.parse(localStorage.getItem(LEGACY_EVENTS_KEY)||"[]");
      const name=localStorage.getItem(LEGACY_NAME_KEY)||"Task";
      if(legacy.length>0){return[{id:uid(),name,archived:false,color:COLORS[0],events:legacy.map(iso=>({iso,qty:1}))}]}
      return[{id:uid(),name:"Task A",archived:false,color:COLORS[0],events:[]}];
    }catch{return[{id:uid(),name:"Task",archived:false,color:COLORS[0],events:[]}];}
  });
  const [range,setRange]=useState(30);
  const [showArchived,setShowArchived]=useState(false);
  const [newTaskName,setNewTaskName]=useState("");
  useEffect(() => {localStorage.setItem(STORAGE_KEY_V2,JSON.stringify(tasks));}, [tasks]);

  const activeTasks=useMemo(() => tasks.filter(t => showArchived || !t.archived), [tasks,showArchived]);
  const todayKey=formatDateKey(new Date());

  const totals=useMemo(() => {
    let today=0,total=0;
    for(const t of activeTasks){
      for(const e of t.events){total+=e.qty;if(formatDateKey(new Date(e.iso))===todayKey)today+=e.qty;}
    }
    return{today,total};
  }, [activeTasks,todayKey]);

  const chartData=useMemo(() => {
    const rows=[];const dateKeys=Array.from(daysBack(range),d=>formatDateKey(d));
    for(const dk of dateKeys){const row={date:dk.slice(5),fullDate:dk};
      for(const t of activeTasks){row[t.id]=t.events.filter(e=>formatDateKey(new Date(e.iso))===dk).reduce((s,e)=>s+e.qty,0);} 
      rows.push(row);
    }
    return rows;
  }, [activeTasks,range]);

  const recent=useMemo(() => {
    const list=[];
    for(const t of tasks){
      for(const e of t.events){
        // ensure iso is valid string before Date()
        if(typeof e.iso==="string" && !isNaN(new Date(e.iso).getTime())){
          list.push({taskId:t.id,name:t.name,iso:e.iso,qty:e.qty});
        }
      }
    }
    return list.sort((a,b) => new Date(b.iso)-new Date(a.iso)).slice(0,100);
  }, [tasks]);

  const addTask=() => {const name=newTaskName.trim()||`Task ${tasks.length+1}`;const color=COLORS[tasks.length%COLORS.length];setTasks(p=>[...p,{id:uid(),name,archived:false,color,events:[]}]);setNewTaskName("");};
  const renameTask=(id,name) => setTasks(p=>p.map(t=>t.id===id?{...t,name}:t));
  const toggleArchive=id=>setTasks(p=>p.map(t=>t.id===id?{...t,archived:!t.archived}:t));
  const deleteTask=id=>{if(confirm("Delete this task?"))setTasks(p=>p.filter(t=>t.id!==id));};

  const logQuantity=(id,qty,dateKey=null)=>{
    if(!qty||qty<=0)return;
    const iso=dateKey?toISOAtNoonLocal(dateKey):new Date().toISOString();
    setTasks(p=>p.map(t=>t.id===id?{...t,events:[...t.events,{iso,qty}]}:t));
  };
  const undoLast=id=>setTasks(p=>p.map(t=>t.id===id?{...t,events:t.events.slice(0,-1)}:t));
  const resetAll=()=>{if(confirm("Delete ALL tasks and data?"))setTasks([]);};

  const exportData=()=>download(`task-counter-export-${Date.now()}.json`,JSON.stringify({version:3,exportedAt:new Date().toISOString(),tasks},null,2));
  const importData=file=>{if(!file)return;const r=new FileReader();r.onload=e=>{try{const o=JSON.parse(String(e.target?.result||"{}"));if(!Array.isArray(o.tasks))throw new Error("Invalid");setTasks(o.tasks);}catch(err){alert("Import failed: "+err.message);}};r.readAsText(file);};

  return(
    <div className="min-h-screen w-full bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-2xl sm:text-3xl font-semibold">Task Counter</h1>
          <div className="flex items-center gap-2">
            <button onClick={exportData} className="px-3 py-2 rounded-xl border">Export</button>
            <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 rounded-xl border">Import</button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={e=>importData(e.target.files?.[0])}/>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-end justify-between">
              <div><div className="text-xs">Today</div><div className="text-3xl font-bold">{totals.today}</div></div>
              <div><div className="text-xs text-right">Total</div><div className="text-3xl font-bold text-right">{totals.total}</div></div>
            </div>
            <div className="mt-4">
              {[7,14,30,60,90].map(n=>(<button key={n} onClick={() => setRange(n)} className={`px-3 py-1.5 rounded-xl border text-sm ${range===n?"bg-indigo-600 text-white":"bg-white"}`}>{n}d</button>))}
              <label className="ml-2 text-sm"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Show archived</label>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow p-4 md:col-span-2">
            <label className="text-xs">Add task</label>
            <div className="flex gap-2">
              <input value={newTaskName} onChange={e=>setNewTaskName(e.target.value)} placeholder="Task name" className="flex-1 border rounded-xl px-3"/>
              <button onClick={addTask} className="px-4 py-2 bg-indigo-600 text-white rounded-xl">Add</button>
              <button onClick={resetAll} className="px-4 py-2 bg-red-100 text-red-700 rounded-xl">Reset All</button>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Tasks</h2>
          <ul className="divide-y">
            {tasks.map(t=>(
              <li key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{background:t.color}}/>
                  <input value={t.name} onChange={e=>renameTask(t.id,e.target.value)} className="border rounded px-2 py-1 text-sm"/>
                  {t.archived && <span className="text-xs text-gray-500">(archived)</span>}
                </div>
                <div className="flex items-center gap-2">
                  <TaskEntryAdder onAdd={(qty,date)=>logQuantity(t.id,qty,date)}/>
                  <button onClick={() => undoLast(t.id)} className="px-3 py-1 border rounded">Undo</button>
                  <button onClick={() => toggleArchive(t.id)} className="px-3 py-1 border rounded">{t.archived?"Unarchive":"Archive"}</button>
                  <button onClick={() => deleteTask(t.id)} className="px-3 py-1 border rounded text-red-600">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Counts per day</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="date"/>
                <YAxis allowDecimals={false}/>
                <Tooltip/>
                {activeTasks.map(t=>(<Line key={t.id} type="monotone" dataKey={t.id} stroke={t.color} strokeWidth={3} dot={false} name={t.name}/>))}
                <Legend/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="mt-6 bg-white rounded-2xl shadow p-4">
          <h3 className="text-lg font-semibold mb-2">Recent activity</h3>
          <ul className="max-h-64 overflow-auto divide-y">
            {recent.map((e,idx) => {
              const dt=new Date(e.iso);
              return (
                <li key={idx} className="py-1 text-sm flex justify-between">
                  <span>{e.name}{e.qty>1 && <span className="text-gray-500"> ×{e.qty}</span>}</span>
                  <span className="text-gray-500">{isNaN(dt.getTime())?"" : dt.toLocaleString()}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

function TaskEntryAdder({onAdd}){
  const[qty,setQty]=useState("");
  const[date,setDate]=useState("");
  return(
    <div className="flex items-center gap-1">
      <input type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)} placeholder="Qty" className="w-20 border rounded px-1 text-sm"/>
      <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded px-1 text-sm"/>
      <button onClick={()=>{onAdd(parseInt(qty),date||null);setQty("");setDate("");}} className="px-2 py-1 border rounded bg-indigo-600 text-white text-sm">Add</button>
    </div>
  );
}
