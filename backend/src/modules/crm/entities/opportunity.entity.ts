import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
@Entity('crm_opportunities')
export class Opportunity {
 @PrimaryGeneratedColumn('uuid') id:string;
 @Column({name:'customer_id',type:'uuid',nullable:true}) customerId:string;
 @Column({length:255}) title:string;
 @Column({name:'contact_name',length:255,nullable:true}) contactName:string;
 @Column({name:'contact_email',length:255,nullable:true}) contactEmail:string;
 @Column({name:'contact_phone',length:50,nullable:true}) contactPhone:string;
 @Column({type:'varchar',length:30,default:'lead'}) stage:string;
 @Column({type:'decimal',precision:12,scale:2,default:0}) value:number;
 @Column({type:'int',default:10}) probability:number;
 @Column({name:'expected_close_date',type:'date',nullable:true}) expectedCloseDate:string;
 @Column({name:'lost_reason',type:'text',nullable:true}) lostReason:string;
 @Column({type:'text',nullable:true}) notes:string;
 @Column({type:'varchar',length:30,nullable:true}) source:string;
 @Column({type:'jsonb',default:()=>"'[]'::jsonb"}) tags:string[];
 @Column({name:'owner_id',type:'uuid',nullable:true}) ownerId:string;
 @CreateDateColumn({name:'created_at'}) createdAt:Date;
 @UpdateDateColumn({name:'updated_at'}) updatedAt:Date;
 @ManyToOne(()=>Customer,{nullable:true}) @JoinColumn({name:'customer_id'}) customer:Customer;
 @ManyToOne(()=>User,{nullable:true}) @JoinColumn({name:'owner_id'}) owner:User;
}
