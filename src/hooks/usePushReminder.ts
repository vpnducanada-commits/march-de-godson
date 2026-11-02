import { useEffect } from 'react';
export function usePushReminder(){
  useEffect(()=>{
    if(!('Notification' in window)) return;
    if(Notification.permission!=='granted') return;
    const last = localStorage.getItem('gm_last_visit');
    const now=Date.now();
    if(!last){ localStorage.setItem('gm_last_visit', String(now)); return; }
    const diff = now - parseInt(last,10);
    if(diff > 7*24*60*60*1000){
      if('serviceWorker' in navigator){
        navigator.serviceWorker.ready.then(reg=>{
          reg.showNotification('GODSON Marketplace', {
            body: 'Ton annonce est toujours en ligne — as-tu reçu des messages ?',
            icon: '/icons/icon-192.png',
          } as any).catch(()=>{});
        });
      } else {
        try{ new Notification('GODSON Marketplace', { body: 'Ton annonce est toujours en ligne !' }); }catch{}
      }
      localStorage.setItem('gm_last_visit', String(now));
    }
    if(diff > 24*60*60*1000) localStorage.setItem('gm_last_visit', String(now));
  },[]);
}
export function requestPush(){
  if(!('Notification' in window)) return Promise.resolve('denied' as NotificationPermission);
  return Notification.requestPermission();
}
