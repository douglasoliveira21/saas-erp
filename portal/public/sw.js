self.addEventListener('push',event=>{
  let data={};try{data=event.data?event.data.json():{}}catch{}
  event.waitUntil(self.registration.showNotification(data.title||'Portal VGON',{
    body:data.body||'Você recebeu uma nova atualização.',
    icon:'/vgon-logo.png',badge:'/vgon-logo.png',tag:data.tag||'portal-vgon',
    data:{url:data.url||'/'},requireInteraction:false
  }))
})
self.addEventListener('notificationclick',event=>{
  event.notification.close()
  const target=new URL(event.notification.data?.url||'/',self.location.origin).href
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    const opened=list.find(client=>client.url.startsWith(self.location.origin))
    if(opened){opened.navigate(target);return opened.focus()}
    return clients.openWindow(target)
  }))
})
