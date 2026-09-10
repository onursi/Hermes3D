"use client";
import Link from 'next/link';
export function RoomLinks(){return <details className="atelier-rooms"><summary>◈ Räume</summary><nav aria-label="Alle Räume"><Link href="/v2">Zuhause</Link><Link href="/v2?room=cosmos">Second Brain</Link><Link href="/v2?room=projects">Project Singularity</Link><Link href="/v2?room=memory">Memory Orbit</Link><Link href="/v2?room=horizon">Goal Horizon</Link><Link href="/v2?room=success">Success Singularity</Link><Link href="/v2?room=flow">Flow Orbit</Link><Link href="/v2?room=sanctuary">Vision Sanctuary</Link></nav></details>;}
