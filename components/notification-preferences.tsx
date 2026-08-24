"use client"

import { useCallback, useEffect, useState } from "react"
import { Settings2 } from "lucide-react"

type Preferences = { study:boolean;groupStudy:boolean;rewards:boolean;rankings:boolean;announcements:boolean }
const defaults:Preferences={study:true,groupStudy:true,rewards:true,rankings:true,announcements:true}
const options:Array<[keyof Preferences,string]>=[["study","Study reminders"],["groupStudy","Group Study activity"],["rewards","XP and NP rewards"],["rankings","Rankings and seasons"],["announcements","Product announcements"]]

function headers():Record<string,string>{try{const token=localStorage.getItem("mednexus-user-token");return token?{"x-session-token":token}:{} }catch{return {}}}

export function NotificationPreferences(){
  const [open,setOpen]=useState(false),[values,setValues]=useState(defaults),[saving,setSaving]=useState(false)
  const load=useCallback(async()=>{const response=await fetch("/api/notification-preferences",{headers:headers(),cache:"no-store"});if(response.ok){const data=await response.json();setValues(data.preferences??defaults)}},[])
  useEffect(()=>{if(open)void load()},[load,open])
  const change=async(key:keyof Preferences)=>{const next={...values,[key]:!values[key]};setValues(next);setSaving(true);try{await fetch("/api/notification-preferences",{method:"PATCH",headers:{"Content-Type":"application/json",...headers()},body:JSON.stringify(next)})}finally{setSaving(false)}}
  return <div className="mx-auto max-w-2xl px-4 pt-4"><button onClick={()=>setOpen(value=>!value)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold"><Settings2 size={15}/>Notification preferences</button>{open?<section className="mt-3 rounded-2xl border border-border bg-card p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Your preferences</h2><span className="text-xs text-muted-foreground">{saving?"Saving…":"Saved automatically"}</span></div><div className="grid gap-2 sm:grid-cols-2">{options.map(([key,label])=><label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border px-3 py-3 text-sm font-semibold"><span>{label}</span><input type="checkbox" checked={values[key]} onChange={()=>void change(key)} className="size-4 accent-primary"/></label>)}</div><p className="mt-3 text-xs text-muted-foreground">Critical account and safety messages cannot be disabled.</p></section>:null}</div>
}
