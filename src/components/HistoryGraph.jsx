import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { db } from "../db/db";
import { ComposedChart, Line, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import projectCrackGrowth from "../lib/parisLaw.js";

const T = {
  bg:"#0a0f1a", surface:"#111827", border:"#1e2d40",
  accentC:"#a78bfa", accentA:"#00c2ff", danger:"#ef4444",
  muted:"#64748b", text:"#e2e8f0", pass:"#22c55e", ground:"#f97316",
  mono:"'IBM Plex Mono', monospace", sans:"'Inter', sans-serif",
};
const SEV = { none:"#1e2d40", low:"#166534", medium:"#854d0e", high:"#ef4444", critical:"#dc2626" };
const sevColor = (c,max) => c===0?SEV.none:c/max<0.2?SEV.low:c/max<0.5?SEV.medium:c/max<0.8?SEV.high:SEV.critical;
const sevLabel = (c,max) => c===0?"None":c/max<0.2?"Low":c/max<0.5?"Medium":c/max<0.8?"High":"Critical";

function groupRecords(records) {
  const g={};
  for(const r of records){
    if(!r.estimatedLengthMM||r.defectType!=="crack") continue;
    const k=`${r.tailNumber}_${r.defectType}_${r.zone}`;
    if(!g[k]) g[k]=[];
    g[k].push(r);
  }
  return g;
}
const fmtDate = iso => new Date(iso).toLocaleDateString("en-GB",{day:"2-digit",month:"short"});

function buildChartData(records, projectionCurve, latestDate){
  const HPC=1.5, MPH=3_600_000;
  const actuals = records.filter(r=>r.estimatedLengthMM>0)
    .sort((a,b)=>new Date(a.inspectionDate)-new Date(b.inspectionDate))
    .map(r=>({label:fmtDate(r.inspectionDate),actual:r.estimatedLengthMM,proj:null}));
  const proj = (projectionCurve??[])
    .filter((_,i)=>i%5===0||i===(projectionCurve.length-1))
    .map(pt=>({label:fmtDate(new Date(new Date(latestDate).getTime()+pt.cycle*HPC*MPH).toISOString()),actual:null,proj:pt.crackMM}));
  if(actuals.length>0&&proj.length>0) actuals[actuals.length-1].proj=actuals[actuals.length-1].actual;
  return [...actuals,...proj];
}

const ZONES=[
  {id:"fuselage",label:"Fuselage",paths:["M-220,0 Q-230,-22 -200,-28 L170,-28 Q185,-28 195,-22 L210,0 L195,22 Q185,28 170,28 L-200,28 Q-230,22 -220,0 Z"],lx:-30,ly:5},
  {id:"nose",label:"Nose",paths:["M-220,-18 Q-260,-10 -290,0 Q-260,10 -220,18 Z"],lx:-262,ly:5},
  {id:"wing",label:"Wings",paths:["M-60,-28 L-30,-115 Q-18,-132 2,-126 L12,-28 Z","M-60,28 L-30,115 Q-18,132 2,126 L12,28 Z"],lx:-28,ly:-85},
  {id:"tail",label:"Tail",paths:["M160,-28 L168,-74 Q172,-82 180,-80 L187,-28 Z","M160,28 L168,74 Q172,82 180,80 L187,28 Z","M158,-28 L164,-94 Q167,-104 175,-102 L192,-28 Z"],lx:185,ly:-56},
  {id:"engine",label:"Engine",paths:["M-82,-52 Q-92,-63 -58,-66 L22,-66 Q42,-63 46,-52 L46,-40 Q42,-29 22,-28 L-58,-28 Q-92,-30 -82,-40 Z","M-82,52 Q-92,63 -58,66 L22,66 Q42,63 46,52 L46,40 Q42,29 22,28 L-58,28 Q-92,30 -82,40 Z"],lx:-18,ly:-50},
  {id:"landing_gear",label:"Gear",rects:[{x:-141,y:28,w:18,h:30},{x:-11,y:28,w:18,h:30},{x:130,y:28,w:14,h:22}],lx:-10,ly:76},
];

function FleetHeatmap({ records }){
  const svgRef=useRef(null);
  const [scale,setScale]=useState(1);
  const [rotate,setRotate]=useState(0);
  const [tx,setTx]=useState(0);
  const [ty,setTy]=useState(0);
  const [tip,setTip]=useState(null);
  const drag=useRef({active:false,lx:0,ly:0});
  const lastDist=useRef(null);

  const zoneCounts=useMemo(()=>{
    const c={};
    records.forEach(r=>{if(r.zone) c[r.zone]=(c[r.zone]||0)+1;});
    return c;
  },[records]);
  const maxCount=useMemo(()=>Math.max(...Object.values(zoneCounts),1),[zoneCounts]);

  const clamp=s=>Math.min(Math.max(s,0.25),5);
  const zoom=useCallback(f=>setScale(s=>clamp(s*f)),[]);
  const reset=()=>{setScale(1);setRotate(0);setTx(0);setTy(0);};

  useEffect(()=>{
    const el=svgRef.current; if(!el) return;
    const h=e=>{e.preventDefault();zoom(e.deltaY<0?1.1:0.9);};
    el.addEventListener("wheel",h,{passive:false});
    return()=>el.removeEventListener("wheel",h);
  },[zoom]);

  const onMD=e=>{drag.current={active:true,lx:e.clientX,ly:e.clientY};};
  const onMM=e=>{
    if(!drag.current.active) return;
    setTx(x=>x+e.clientX-drag.current.lx); setTy(y=>y+e.clientY-drag.current.ly);
    drag.current.lx=e.clientX; drag.current.ly=e.clientY;
  };
  const onMU=()=>{drag.current.active=false;};
  const onTS=e=>{
    if(e.touches.length===1){drag.current={active:true,lx:e.touches[0].clientX,ly:e.touches[0].clientY};}
    if(e.touches.length===2) lastDist.current=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  };
  const onTM=e=>{
    if(e.touches.length===1&&drag.current.active){
      setTx(x=>x+e.touches[0].clientX-drag.current.lx); setTy(y=>y+e.touches[0].clientY-drag.current.ly);
      drag.current.lx=e.touches[0].clientX; drag.current.ly=e.touches[0].clientY;
    }
    if(e.touches.length===2&&lastDist.current){
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      zoom(d/lastDist.current); lastDist.current=d;
    }
  };
  const onTE=()=>{drag.current.active=false;lastDist.current=null;};

  const tf=`translate(${340+tx},${170+ty}) rotate(${rotate}) scale(${scale})`;
  const btn={background:"transparent",border:`0.5px solid ${T.border}`,borderRadius:6,padding:"4px 10px",fontSize:12,color:T.muted,cursor:"pointer",fontFamily:T.mono};

  return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,marginBottom:16}}>
      <div style={{padding:"12px 16px 0",fontFamily:T.mono,fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em"}}>
        Fleet heatmap — defect frequency by zone
      </div>
      <div style={{position:"relative",overflow:"hidden",background:T.bg,margin:12,borderRadius:6,border:`1px solid ${T.border}`}}>
        <svg ref={svgRef} viewBox="0 0 680 340" style={{display:"block",width:"100%",cursor:"grab"}}
          onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
          onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
          <g opacity="0.07">
            {[85,170,255].map(y=><line key={y} x1="0" y1={y} x2="680" y2={y} stroke={T.accentA} strokeWidth="0.5"/>)}
            {[170,340,510].map(x=><line key={x} x1={x} y1="0" x2={x} y2="340" stroke={T.accentA} strokeWidth="0.5"/>)}
          </g>
          <g transform={tf}>
            {ZONES.map(zone=>{
              const count=zoneCounts[zone.id]||0;
              const color=sevColor(count,maxCount);
              const isHov=tip?.id===zone.id;
              const handlers={
                onMouseEnter:e=>{
                  const box=svgRef.current.getBoundingClientRect();
                  setTip({id:zone.id,label:zone.label,count,x:e.clientX-box.left+14,y:e.clientY-box.top-10});
                },
                onMouseLeave:()=>setTip(null),
              };
              return(
                <g key={zone.id} style={{cursor:"pointer",filter:isHov?"brightness(1.35)":"none"}}>
                  {zone.paths?.map((d,i)=><path key={i} d={d} fill={color} stroke={isHov?T.accentA:"#334155"} strokeWidth={isHov?1.5:0.8} {...handlers}/>)}
                  {zone.rects?.map((r,i)=><rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx="3" fill={color} stroke={isHov?T.accentA:"#334155"} strokeWidth={isHov?1.5:0.8} {...handlers}/>)}
                  <text x={zone.lx} y={zone.ly} textAnchor="middle" style={{fontFamily:T.mono,fontSize:9,fill:isHov?"#fff":"#e2e8f0",pointerEvents:"none"}}>{zone.label}</text>
                  {count>0&&<text x={zone.lx} y={zone.ly+12} textAnchor="middle" style={{fontFamily:T.mono,fontSize:8,fill:T.accentA,fontWeight:600,pointerEvents:"none"}}>{count}</text>}
                </g>
              );
            })}
            <ellipse cx="-215" cy="-10" rx="8" ry="5" fill="#1e3a5f" opacity="0.9" style={{pointerEvents:"none"}}/>
            <ellipse cx="-215" cy="10" rx="8" ry="5" fill="#1e3a5f" opacity="0.9" style={{pointerEvents:"none"}}/>
            <ellipse cx="-82" cy="-52" rx="7" ry="5" fill={T.bg} opacity="0.7" style={{pointerEvents:"none"}}/>
            <ellipse cx="-82" cy="52" rx="7" ry="5" fill={T.bg} opacity="0.7" style={{pointerEvents:"none"}}/>
          </g>
        </svg>
        {tip&&(
          <div style={{position:"absolute",left:tip.x,top:tip.y,background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"8px 12px",fontFamily:T.mono,fontSize:11,color:T.text,pointerEvents:"none",zIndex:10}}>
            <div style={{color:T.accentC,marginBottom:4}}>{tip.label}</div>
            <div>{tip.count} defect{tip.count!==1?"s":""}</div>
            <div style={{color:T.muted,marginTop:2}}>Severity: {sevLabel(tip.count,maxCount)}</div>
          </div>
        )}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"0 12px 10px",flexWrap:"wrap"}}>
        <button onClick={()=>zoom(1.2)} style={btn}>＋</button>
        <button onClick={()=>zoom(0.8)} style={btn}>－</button>
        <input type="range" min="25" max="500" value={Math.round(scale*100)} style={{width:80,accentColor:T.accentC}} onChange={e=>setScale(clamp(e.target.value/100))}/>
        <span style={{fontFamily:T.mono,fontSize:10,color:T.muted,minWidth:36}}>{Math.round(scale*100)}%</span>
        <span style={{fontFamily:T.mono,fontSize:10,color:T.muted,marginLeft:8}}>Z-Rotate</span>
        <input type="range" min="0" max="360" value={rotate} style={{width:90,accentColor:T.accentA}} onChange={e=>setRotate(+e.target.value)}/>
        <span style={{fontFamily:T.mono,fontSize:10,color:T.muted,minWidth:30}}>{rotate}°</span>
        <div style={{flex:1}}/>
        <button onClick={reset} style={btn}>Reset</button>
      </div>
      <div style={{display:"flex",gap:12,padding:"8px 12px 12px",borderTop:`1px solid ${T.border}`,flexWrap:"wrap"}}>
        {Object.entries(SEV).map(([k,c])=>(
          <div key={k} style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:10,height:10,borderRadius:2,background:c}}/>
            <span style={{fontFamily:T.mono,fontSize:10,color:T.muted,textTransform:"capitalize"}}>{k}</span>
          </div>
        ))}
        <div style={{flex:1}}/>
        <span style={{fontFamily:T.mono,fontSize:10,color:T.muted}}>Drag · Scroll · Pinch</span>
      </div>
    </div>
  );
}

function EmptyState(){
  return(
    <div style={{textAlign:"center",padding:"48px 24px"}}>
      <svg viewBox="0 0 120 60" style={{width:120,marginBottom:20,opacity:0.3}}>
        <ellipse cx="60" cy="30" rx="38" ry="9" fill={T.accentA}/>
        <polygon points="22,30 2,34 2,26" fill={T.accentA}/>
        <polygon points="98,30 118,34 118,26" fill={T.accentA}/>
        <polygon points="50,21 70,30 50,30" fill={T.accentA} opacity="0.6"/>
        <polygon points="50,21 30,30 50,30" fill={T.accentA} opacity="0.6"/>
        <ellipse cx="98" cy="30" rx="5" ry="7" fill={T.accentA} opacity="0.5"/>
      </svg>
      <div style={{fontFamily:T.mono,fontSize:13,color:T.muted,marginBottom:8}}>NO INSPECTION HISTORY</div>
      <div style={{fontSize:13,color:T.muted,lineHeight:1.6,marginBottom:20}}>Run a LiveScan inspection to generate<br/>historical defect analytics.</div>
      <div style={{display:"inline-block",fontFamily:T.mono,fontSize:11,color:T.accentA,border:`1px solid ${T.accentA}`,borderRadius:6,padding:"8px 20px"}}>← Switch to LiveScan to begin</div>
    </div>
  );
}

function VerdictCard({result,groupKey}){
  const[,defect,zone]=groupKey.split("_");
  const isGround=result.cyclesRemaining===0;
  const color=isGround?T.ground:T.pass;
  return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderLeft:`3px solid ${color}`,borderRadius:6,padding:"12px 16px",marginBottom:10}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <span style={{fontFamily:T.mono,fontSize:10,color,textTransform:"uppercase",letterSpacing:"0.1em",background:`${color}18`,padding:"2px 8px",borderRadius:3}}>{isGround?"⚠ GROUND":"PASS"}</span>
        <span style={{fontFamily:T.mono,fontSize:11,color:T.muted}}>{defect} · {zone}</span>
      </div>
      <p style={{color:T.text,fontSize:13,lineHeight:1.5,margin:0}}>{result.verdictText}</p>
      {!isGround&&result.cyclesRemaining>0&&(
        <div style={{display:"flex",gap:20,marginTop:10}}>
          {[["Cycles remaining",result.cyclesRemaining.toLocaleString()],["Flight hours",result.hoursRemaining.toLocaleString()],["Breach date",result.projectedBreachDate?.toISOString().slice(0,10)??"—"]].map(([l,v])=>(
            <div key={l}>
              <div style={{fontFamily:T.mono,fontSize:9,color:T.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>{l}</div>
              <div style={{fontFamily:T.mono,fontSize:13,color:T.text,fontWeight:600}}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CrackChart({chartData,toleranceLimitMM,groupKey}){
  const[,,zone]=groupKey.split("_");
  const CT=({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    return(
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"10px 14px"}}>
        <div style={{fontFamily:T.mono,fontSize:10,color:T.muted,marginBottom:6}}>{label}</div>
        {payload.map(p=>p.value!=null&&<div key={p.dataKey} style={{color:p.color,fontFamily:T.mono,fontSize:12}}>{p.name}: {p.value.toFixed(2)}mm</div>)}
      </div>
    );
  };
  return(
    <div style={{marginBottom:28}}>
      <div style={{fontFamily:T.mono,fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>{zone} zone — crack length over time</div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{top:8,right:24,bottom:0,left:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
          <XAxis dataKey="label" tick={{fill:T.muted,fontSize:10,fontFamily:T.mono}} axisLine={{stroke:T.border}} tickLine={false}/>
          <YAxis tick={{fill:T.muted,fontSize:10,fontFamily:T.mono}} axisLine={false} tickLine={false} domain={[0,Math.max((toleranceLimitMM??4)*1.3,1)]} tickFormatter={v=>`${v}mm`}/>
          <Tooltip content={<CT/>}/>
          <Legend wrapperStyle={{fontFamily:T.mono,fontSize:11,color:T.muted,paddingTop:8}}/>
          <ReferenceLine y={toleranceLimitMM} stroke={T.danger} strokeWidth={1.5} label={{value:`Limit ${toleranceLimitMM}mm`,position:"insideTopRight",fill:T.danger,fontSize:10,fontFamily:T.mono}}/>
          <Line type="monotone" dataKey="actual" name="Measured crack" stroke={T.accentC} strokeWidth={2} dot={{r:4,fill:T.accentC,strokeWidth:0}} activeDot={{r:6}} connectNulls={false}/>
          <Line type="monotone" dataKey="proj" name="Projected (Paris' Law)" stroke={T.accentA} strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls={false}/>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function HistoryGraph(){
  const[allRecords,setAllRecords]=useState([]);
  const[selectedTail,setSelectedTail]=useState(null);
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    async function load(){
      try{
        const records=await db.inspections.toArray();
        setAllRecords(records);
        const tails=[...new Set(records.map(r=>r.tailNumber).filter(Boolean))];
        setSelectedTail(p=>p&&tails.includes(p)?p:(tails[0]??null));
      }catch(e){console.error("Dexie:",e);}
      finally{setLoading(false);}
    }
    load();
    const i=setInterval(load,3000);
    return()=>clearInterval(i);
  },[]);

  const tailNumbers=useMemo(()=>[...new Set(allRecords.map(r=>r.tailNumber).filter(Boolean))],[allRecords]);
  const tailRecords=useMemo(()=>allRecords.filter(r=>r.tailNumber===selectedTail),[allRecords,selectedTail]);

  const analyses=useMemo(()=>{
    const groups=groupRecords(tailRecords);
    return Object.entries(groups).map(([key,recs])=>{
      const result=projectCrackGrowth(recs);
      const latestDate=recs.filter(r=>r.estimatedLengthMM>0).sort((a,b)=>new Date(b.inspectionDate)-new Date(a.inspectionDate))[0]?.inspectionDate;
      const chartData=buildChartData(recs,result.projectionCurve??[],latestDate);
      return{key,result,chartData,toleranceLimitMM:result.toleranceLimitMM};
    });
  },[tailRecords]);

  const btn={background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 14px",fontSize:12,fontFamily:T.mono,cursor:"pointer"};

  if(loading) return <div style={{...sty.root,textAlign:"center",padding:48}}><div style={{fontFamily:T.mono,fontSize:12,color:T.muted}}>Loading…</div></div>;

  return(
    <div style={sty.root}>
      <div style={sty.hdr}>
        <div>
          <div style={sty.eyebrow}>DRISHTI · Crack History</div>
          <div style={sty.title}>{selectedTail??"Fleet Overview"} <span style={{color:T.muted,fontWeight:400,fontSize:15,marginLeft:12}}>{allRecords.length} records</span></div>
        </div>
        <div style={{fontFamily:T.mono,fontSize:10,color:allRecords.length>0?T.pass:T.muted,background:allRecords.length>0?`${T.pass}18`:`${T.muted}18`,border:`1px solid ${allRecords.length>0?T.pass:T.muted}40`,padding:"4px 10px",borderRadius:4}}>
          {allRecords.length>0?"LIVE · DEXIE":"AWAITING DATA"}
        </div>
      </div>

      {allRecords.length===0?<EmptyState/>:(
        <>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
            {tailNumbers.map(t=>(
              <button key={t} onClick={()=>setSelectedTail(t)} style={{...btn,background:selectedTail===t?T.accentC:T.surface,color:selectedTail===t?T.bg:T.muted,border:`1px solid ${selectedTail===t?T.accentC:T.border}`,fontWeight:selectedTail===t?700:400}}>{t}</button>
            ))}
          </div>
          {analyses.length>0&&<div style={{marginBottom:20}}>{analyses.map(({key,result})=><VerdictCard key={key} result={result} groupKey={key}/>)}</div>}
          {analyses.length===0
            ?<div style={{fontFamily:T.mono,fontSize:12,color:T.muted,padding:"16px 0",marginBottom:20}}>No crack records for {selectedTail} yet.</div>
            :analyses.map(({key,chartData,toleranceLimitMM})=><CrackChart key={key} chartData={chartData} toleranceLimitMM={toleranceLimitMM??4.0} groupKey={key}/>)
          }
          <FleetHeatmap records={allRecords}/>
        </>
      )}
    </div>
  );
}

const sty={
  root:{background:T.bg,borderRadius:10,border:`1px solid ${T.border}`,padding:"24px",fontFamily:T.sans,maxWidth:860},
  hdr:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,paddingBottom:14,borderBottom:`1px solid ${T.border}`},
  eyebrow:{fontFamily:T.mono,fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:4},
  title:{fontSize:20,fontWeight:600,color:T.text,letterSpacing:"-0.02em"},
};
