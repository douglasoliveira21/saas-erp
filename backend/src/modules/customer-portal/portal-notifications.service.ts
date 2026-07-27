import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as webpush from 'web-push';
import { MailService } from '../mail/mail.service';
import { GlpiService } from '../glpi/glpi.service';

@Injectable()
export class PortalNotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PortalNotificationsService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly publicKey = process.env.PORTAL_VAPID_PUBLIC_KEY || '';
  private readonly privateKey = process.env.PORTAL_VAPID_PRIVATE_KEY || '';

  constructor(private db: DataSource, private mail: MailService, private glpi: GlpiService) {
    if (this.publicKey && this.privateKey) webpush.setVapidDetails(process.env.PORTAL_VAPID_SUBJECT || 'mailto:suporte@vgon.com.br', this.publicKey, this.privateKey);
  }
  onModuleInit() { this.timer = setInterval(() => void this.scan(), Number(process.env.PORTAL_NOTIFICATION_INTERVAL_MS || 120000)); setTimeout(() => void this.scan(), 20000); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  getPublicKey() { return { publicKey: this.publicKey, enabled: Boolean(this.publicKey && this.privateKey) }; }

  async subscribe(userId: string, subscription: any) {
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) throw new Error('Assinatura push inválida');
    await this.db.query(`INSERT INTO portal_push_subscriptions(portal_user_id,endpoint,p256dh,auth) VALUES($1,$2,$3,$4) ON CONFLICT(endpoint) DO UPDATE SET portal_user_id=$1,p256dh=$3,auth=$4`, [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]);
    return { success: true };
  }
  async list(userId: string) { return this.db.query(`SELECT id,type,title,body,url,read_at "readAt",created_at "createdAt" FROM portal_notifications WHERE portal_user_id=$1 ORDER BY created_at DESC LIMIT 100`, [userId]); }
  async read(userId: string, id: string) { await this.db.query(`UPDATE portal_notifications SET read_at=NOW() WHERE id=$1 AND portal_user_id=$2`, [id,userId]); return { success:true }; }

  private async notify(customerId: string, roles: string[], ownerId: string | null, type: string, title: string, body: string, url: string, key: string) {
    const users = await this.db.query(`SELECT id,email,name,role FROM portal_users WHERE customer_id=$1 AND status='active' AND (role=ANY($2::varchar[]) OR id=$3)`, [customerId, roles, ownerId]);
    for (const user of users) {
      const inserted = await this.db.query(`INSERT INTO portal_notifications(portal_user_id,type,title,body,url,dedupe_key) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`, [user.id,type,title,body,url,key]);
      if (!inserted[0]) continue;
      const subscriptions = await this.db.query(`SELECT endpoint,p256dh,auth FROM portal_push_subscriptions WHERE portal_user_id=$1`, [user.id]);
      for (const sub of subscriptions) {
        try { await webpush.sendNotification({ endpoint:sub.endpoint, keys:{p256dh:sub.p256dh,auth:sub.auth} } as any, JSON.stringify({ title, body, url, tag:key }), { TTL:86400 }); }
        catch (error: any) { if ([404,410].includes(error?.statusCode)) await this.db.query(`DELETE FROM portal_push_subscriptions WHERE endpoint=$1`,[sub.endpoint]); }
      }
      await this.mail.sendMail(user.email, title, `<p>Olá, ${user.name}.</p><p>${body}</p><p><a href="${process.env.PORTAL_URL || 'https://portal.vgon.com.br'}${url}">Acessar o Portal do Cliente</a></p>`);
    }
  }

  private async scan() {
    if (this.running) return; this.running = true;
    try {
      const tickets = await this.db.query(`SELECT pt.glpi_ticket_id,pt.customer_id,pt.portal_user_id,pt.glpi_entity_id,pt.title FROM portal_tickets pt JOIN portal_users pu ON pu.id=pt.portal_user_id WHERE pu.status='active'`);
      for (const ticket of tickets) {
        try {
          const details = await this.glpi.getPortalTicketDetails(Number(ticket.glpi_ticket_id), Number(ticket.glpi_entity_id));
          const lastFollowup = Math.max(0,...(details.followups || []).map((x:any)=>Number(x.id)||0));
          const state = (await this.db.query(`SELECT status,last_followup_id FROM portal_ticket_notification_state WHERE glpi_ticket_id=$1`,[ticket.glpi_ticket_id]))[0];
          if (state && Number(state.status)!==Number(details.status)) await this.notify(ticket.customer_id,['admin','manager'],ticket.portal_user_id,'ticket_status',`Chamado #${ticket.glpi_ticket_id} atualizado`,`${ticket.title}: status alterado.`, '/?tab=tickets', `ticket:${ticket.glpi_ticket_id}:status:${details.status}`);
          if (state && lastFollowup>Number(state.last_followup_id||0)) {
            const latest=(details.followups||[]).find((x:any)=>Number(x.id)===lastFollowup);
            await this.notify(ticket.customer_id,['admin','manager'],ticket.portal_user_id,'ticket_reply',`Nova resposta no chamado #${ticket.glpi_ticket_id}`,`${latest?.authorName||'Equipe técnica'} respondeu: ${String(latest?.content||'').replace(/<[^>]+>/g,' ').slice(0,180)}`, '/?tab=tickets', `ticket:${ticket.glpi_ticket_id}:followup:${lastFollowup}`);
          }
          await this.db.query(`INSERT INTO portal_ticket_notification_state(glpi_ticket_id,status,last_followup_id,checked_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(glpi_ticket_id) DO UPDATE SET status=$2,last_followup_id=$3,checked_at=NOW()`,[ticket.glpi_ticket_id,details.status,lastFollowup]);
        } catch (error:any) { this.logger.warn(`Falha ao verificar chamado ${ticket.glpi_ticket_id}: ${error.message}`); }
      }
      const docs = await this.db.query(`SELECT 'invoice' type,i.id,i.created_at,c.id customer_id,COALESCE(i.number::text,'') reference FROM invoices i JOIN sales s ON s.id=i.sale_id JOIN customers c ON c.id=s.customer_id WHERE i.created_at>NOW()-INTERVAL '3 minutes' AND LOWER(i.status) NOT IN ('rejeitada','rejeitado','cancelada','cancelado','erro','falha') UNION ALL SELECT 'payment',p.id,p.created_at,p.customer_id,COALESCE(p.codigo_solicitacao,'') FROM payments p WHERE p.created_at>NOW()-INTERVAL '3 minutes' AND LOWER(p.status) NOT IN ('rejeitada','rejeitado','cancelada','cancelado','erro','falha')`);
      for(const doc of docs) await this.notify(doc.customer_id,['admin','finance'],null,doc.type,doc.type==='invoice'?'Nova nota fiscal disponível':'Nova cobrança disponível',doc.type==='invoice'?`A nota fiscal ${doc.reference||''} já está disponível.`:'Um novo boleto ou PIX foi emitido para sua empresa.','/?tab=documents',`${doc.type}:${doc.id}`);
    } finally { this.running=false; }
  }
}
