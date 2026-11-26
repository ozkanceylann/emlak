import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Building2, CalendarDays, Eye,
  Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, CircleHelp,
  ClipboardList, Clock3, Cloud, Filter, Heart, Home, LayoutDashboard, ListFilter,
  LogOut, MapPin, Menu, MessageCircle, MoreHorizontal, Plus, Search, Settings,
  SlidersHorizontal, Sparkles, Users, X, BedDouble, Ruler, Bath, LandPlot,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import './styles.css'

const propertiesSeed = [
  { id: '1', title: 'Ferah ve aydınlık aile dairesi', type: 'Satılık', kind: 'Daire', district: 'Bornova', neighborhood: 'Kazımdirik Mah.', rooms: '3+1', area: 145, price: 6850000, image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=85', badge: 'Yeni portföy', views: 126 },
  { id: '2', title: 'Merkezi konumda modern daire', type: 'Kiralık', kind: 'Daire', district: 'Karşıyaka', neighborhood: 'Bostanlı Mah.', rooms: '2+1', area: 105, price: 28500, image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85', badge: 'Öne çıkan', views: 84 },
  { id: '3', title: 'Yatırımlık, imarlı arsa', type: 'Satılık', kind: 'Arsa', district: 'Urla', neighborhood: 'İskele Mah.', rooms: '—', area: 420, price: 7900000, image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=85', badge: 'Fiyatı güncellendi', views: 57 },
]
const navItems = [
  { label: 'Genel Bakış', icon: LayoutDashboard }, { label: 'Portföyler', icon: Building2 },
  { label: 'Müşteriler', icon: Users }, { label: 'Mal Sahipleri', icon: Home },
  { label: 'Randevular', icon: CalendarDays }, { label: 'İş Takibi', icon: ClipboardList },
]
const money = n => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n || 0)
const kindCodes = { Daire: 'apartment', Villa: 'villa', Arsa: 'land', Tarla: 'field', 'İş yeri': 'commercial', 'Müstakil ev': 'detached', Diğer: 'other' }
const kindLabels = Object.fromEntries(Object.entries(kindCodes).map(([label, code]) => [code, label]))

function App() {
  const accessLoadingUser = useRef(null)
  const [page, setPage] = useState('Genel Bakış')
  const [tab, setTab] = useState('Satılık')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState('')
  const [properties, setProperties] = useState(propertiesSeed)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [company, setCompany] = useState('Aras Emlak')
  const [companyId, setCompanyId] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [liveStats, setLiveStats] = useState(null)
  const [toast, setToast] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedDistrict, setSelectedDistrict] = useState('Tüm ilçeler')
  const [maxPrice, setMaxPrice] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session?.user || !supabase) { accessLoadingUser.current = null; return }
    if (accessLoadingUser.current === session.user.id) return
    accessLoadingUser.current = session.user.id
    const loadAccess = async () => {
      const setupCode = sessionStorage.getItem('emlak_platform_setup_code')
      if (setupCode) {
        sessionStorage.removeItem('emlak_platform_setup_code')
        const {error} = await supabase.rpc('claim_initial_platform_admin',{setup_token:setupCode})
        if (error) { sessionStorage.setItem('emlak_platform_setup_code',setupCode); notify(error.message); accessLoadingUser.current = null }
      } else {
        await supabase.rpc('claim_company_office')
      }
      const {data:admin}=await supabase.from('platform_admins').select('user_id').eq('user_id',session.user.id).maybeSingle()
      setIsPlatformAdmin(Boolean(admin))
      const {data:members}=await supabase.from('company_members').select('id,company_id,role,companies(name)').limit(1)
      if(members?.[0]) {
        setProfile(members[0]);setCompanyId(members[0].company_id);setCompany(members[0].companies?.name||'Aras Emlak')
      } else {
        setProfile(null);setCompanyId(null)
      }
    }
    loadAccess()
  }, [session])
  useEffect(() => {
    if (!session || !supabase) return
    supabase.from('properties').select('id,company_id,created_by,title,listing_type,property_type,district,districts(name),neighborhood,room_count,area_sqm,price,cover_image_url,created_at')
      .order('created_at', { ascending: false }).limit(60).then(({ data }) => {
        setProperties((data||[]).map(p => ({...p, type: p.listing_type === 'sale' ? 'Satılık' : 'Kiralık', kind: kindLabels[p.property_type] || p.property_type, district: p.districts?.name || p.district || '', neighborhood: p.neighborhood || '', rooms: p.room_count || '—', area: p.area_sqm, image: p.cover_image_url || propertiesSeed[0].image, price: Number(p.price || 0), views: 0 })))
      })
  }, [session])
  useEffect(() => {
    if (!session || !supabase) { setLiveStats(null); return }
    const now = new Date()
    const weekEnd = new Date(now); weekEnd.setDate(now.getDate()+7)
    Promise.all([
      supabase.from('properties').select('id',{count:'exact',head:true}).eq('status','active'),
      supabase.from('clients').select('id',{count:'exact',head:true}).eq('is_active',true),
      supabase.from('appointments').select('id',{count:'exact',head:true}).gte('starts_at',now.toISOString()).lte('starts_at',weekEnd.toISOString()).eq('status','scheduled'),
      supabase.from('property_views').select('id',{count:'exact',head:true})
    ]).then(([p,c,a,v])=>setLiveStats({properties:p.count||0,clients:c.count||0,appointments:a.count||0,views:v.count||0}))
  },[session,refreshKey])

  const filtered = useMemo(() => properties.filter(p => p.type === tab && `${p.title} ${p.district} ${p.neighborhood} ${p.kind}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')) && (selectedDistrict === 'Tüm ilçeler' || p.district === selectedDistrict) && (!maxPrice || p.price <= Number(maxPrice))), [properties, tab, query, selectedDistrict, maxPrice])
  const notify = text => { setToast(text); setTimeout(() => setToast(''), 2600) }
  const addListing = async form => {
    if (!supabase) { notify('Veritabanı bağlantısı kurulamadı; kayıt yapılamadı.'); return }
    if (!session?.user) { notify('Ön izleme modundasınız. Kalıcı kayıt için giriş yapın.'); setModal('login'); return }
    if (String(form.province_id)==='45' && (!form.district_id||!form.neighborhood)) { notify('Manisa için ilçe ve mahalle seçin.'); return }
    const { data: membership, error: membershipError } = await supabase.from('company_members').select('company_id').limit(1).maybeSingle()
    if (membershipError) { notify('Ofis bağlantısı kontrol edilemedi: '+membershipError.message); return }
    if (!membership?.company_id) { notify('Hesabınız bir emlak ofisine bağlı değil. Ofis yöneticinizle iletişime geçin.'); return }
    const area = form.area === '' ? null : Number(form.area)
    const { data: props, error } = await supabase.from('properties').insert({ company_id: membership.company_id, created_by: session.user.id, listing_type: form.type === 'Satılık' ? 'sale' : 'rent', property_type: kindCodes[form.kind], title: form.title, province_id: Number(form.province_id), district_id: form.district_id ? Number(form.district_id) : null, district: form.district, neighborhood: form.neighborhood, room_count: form.rooms, area_sqm: area, price: Number(form.price), description: form.description, status: 'active' }).select().single()
    if (error) { notify('Portföy kaydedilemedi: '+error.message); return }
    setProperties(curr => [{...props, id: props.id, type: form.type, kind: form.kind, rooms: form.rooms, area, image: propertiesSeed[0].image, views: 0}, ...curr])
    setModal('')
    notify('Portföy kaydedildi')
  }
  const signOut = async () => { await supabase?.auth.signOut(); setSession(null); notify('Oturum kapatıldı') }
  const shareListing = async propertyId => {
    const property = properties.find(item => item.id === propertyId)
    if (supabase && session?.user && property?.company_id) {
      const { error: publishError } = await supabase.from('properties').update({is_published:true}).eq('id',propertyId)
      if (publishError) { notify(publishError.message); return }
      const { data, error } = await supabase.from('property_shares').insert({company_id:property.company_id,property_id:propertyId,created_by:session.user.id}).select('token').single()
      if (error) { notify(error.message); return }
      const link = `${window.location.origin}/ilan/${data.token}`
      await navigator.clipboard?.writeText(link)
      notify('İlan linki kopyalandı')
    } else {
      await navigator.clipboard?.writeText(`${window.location.origin}/ilan/${propertyId}`)
      notify('Paylaşım bağlantısı için önce Supabase hesabıyla giriş yapın')
    }
  }
  const saveRecord = async (kind, form) => {
    if (!supabase || !session?.user || !companyId) { notify('Önce ofis hesabınızla giriş yapın'); return }
    const table = {client:'clients',owner:'owners',appointment:'appointments',task:'tasks'}[kind]
    const common = {company_id:companyId,created_by:session.user.id}
    const body = kind==='client' ? {...common,full_name:form.full_name,phone:form.phone,email:form.email||null,budget_min:form.budget_min?Number(form.budget_min):null,budget_max:form.budget_max?Number(form.budget_max):null,preferred_listing_type:form.preferred_listing_type||null,notes:form.notes||null}
      : kind==='owner' ? {...common,full_name:form.full_name,phone:form.phone,email:form.email||null,notes:form.notes||null}
      : kind==='appointment' ? {...common,starts_at:new Date(form.starts_at).toISOString(),location:form.location||null,notes:form.notes||null,reminder_minutes:Number(form.reminder_minutes||60)}
      : {...common,title:form.title,notes:form.notes||null,due_at:form.due_at?new Date(form.due_at).toISOString():null}
    const {error}=await supabase.from(table).insert(body)
    if(error){notify(error.message);return}
    setModal('');setRefreshKey(k=>k+1);notify('Kayıt eklendi')
  }
  const createOffice = async form => {
    if(!supabase||!isPlatformAdmin){notify('Ofis açma yetkisi yalnızca platform yöneticisinde bulunur');return}
    const {error}=await supabase.rpc('create_company',{company_name:form.name,initial_admin_email:form.admin_email})
    if(error){notify(error.message);return}
    setModal('');setRefreshKey(k=>k+1);notify('Emlak ofisi oluşturuldu')
  }

  if (window.location.pathname.startsWith('/ilan/')) {
    return <PublicListing token={window.location.pathname.split('/')[2]}/>
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Building2 size={20} strokeWidth={2.2} /></div><div><strong>ARAS</strong><span>EMLAK YÖNETİMİ</span></div><button className="mobile-close" onClick={() => setMobileMenu(false)}><X size={18}/></button></div>
      <button className="office-switch"><div className="office-avatar">A</div><span><b>{company}</b><small>{profile?.role === 'owner' ? 'Ofis yöneticisi' : 'Gayrimenkul ofisi'}</small></span><ChevronsUpDown size={15}/></button>
      <div className="side-label">MENÜ</div>
      <nav className="main-nav">{navItems.map(({label, icon: Icon}) => <button key={label} onClick={() => {setPage(label); setMobileMenu(false)}} className={`nav-link ${page===label?'active':''}`}><Icon size={18}/><span>{label}</span>{label==='Randevular' && <i>3</i>}</button>)}</nav>
      <div className="side-label side-label-spaced">YÖNETİM</div>
      <nav className="main-nav">{isPlatformAdmin&&<button className={`nav-link ${page==='Ofisler'?'active':''}`} onClick={()=>setPage('Ofisler')}><Building2 size={18}/><span>Emlak ofisleri</span></button>}<button className={`nav-link ${page==='Danışmanlar'?'active':''}`} onClick={()=>setPage('Danışmanlar')}><Users size={18}/><span>Danışmanlar</span></button><button className={`nav-link ${page==='Raporlar'?'active':''}`} onClick={()=>setPage('Raporlar')}><ListFilter size={18}/><span>Raporlar</span></button><button className={`nav-link ${page==='Ayarlar'?'active':''}`} onClick={()=>setPage('Ayarlar')}><Settings size={18}/><span>Ayarlar</span></button></nav>
      <div className="sidebar-bottom"><div className="storage-card"><div className="storage-icon"><Cloud size={16}/></div><div><strong>Güvende ve güncel</strong><span>Verileriniz bulutta saklanıyor</span></div><Check size={15} className="storage-check"/></div><button className="help-link"><CircleHelp size={17}/> Yardım ve destek</button><button className="user-profile" onClick={session?signOut:()=>setModal('login')}><div className="user-avatar">Ö</div><span><b>{session?.user?.email?.split('@')[0] || 'Özkan Ceylan'}</b><small>{session ? 'Hesabım · Çıkış' : 'Ön izleme modu'}</small></span><MoreHorizontal size={18}/></button></div>
    </aside>
    {mobileMenu && <div className="scrim" onClick={()=>setMobileMenu(false)} />}
    <main className="main-area">
      <header className="topbar"><div className="top-left"><button className="menu-toggle" onClick={()=>setMobileMenu(true)}><Menu size={20}/></button><div className="crumb">Aras Emlak <ChevronRight size={14}/> <span>{page}</span></div></div><div className="top-actions"><div className="sync-chip"><span/> Son senkronizasyon şimdi</div><button className="icon-button" title="Bildirimler" onClick={()=>notify('Yeni bildiriminiz yok')}><Bell size={18}/><i/></button><div className="top-divider"/><button className="top-user" onClick={session?signOut:()=>setModal('login')}><div className="user-avatar small">Ö</div><span>Özkan Ceylan</span><ChevronDown size={15}/></button></div></header>
      <div className="content-wrap">
        {page==='Ofisler'&&isPlatformAdmin ? <AdminOfficesPage refreshKey={refreshKey} openModal={setModal}/> : page==='Genel Bakış' ? <Dashboard properties={properties} stats={liveStats} setPage={setPage} openModal={setModal} /> : page==='Portföyler' ? <>
          <section className="page-heading"><div><div className="eyebrow">PORTFÖY YÖNETİMİ</div><h1>Portföyleriniz</h1><p>Tüm gayrimenkul ilanlarınızı tek yerden yönetin.</p></div><button className="primary-button" onClick={()=>setModal('listing')}><Plus size={18}/> Yeni portföy ekle</button></section>
          <div className="listing-tabs"><button onClick={()=>setTab('Satılık')} className={tab==='Satılık'?'selected':''}><span className="tab-dot sale"/>Satılık <b>{properties.filter(p=>p.type==='Satılık').length}</b></button><button onClick={()=>setTab('Kiralık')} className={tab==='Kiralık'?'selected':''}><span className="tab-dot rent"/>Kiralık <b>{properties.filter(p=>p.type==='Kiralık').length}</b></button><div className="tabs-spacer"/><span className="view-total">Toplam {properties.length} portföy</span></div>
          <div className="filter-bar"><div className="search-box"><Search size={17}/><input placeholder="Portföy, mahalle veya ilçe ara..." value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><button className={`filter-button ${filtersOpen?'toggled':''}`} onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={16}/> Filtrele <span className="filter-count">{selectedDistrict!=='Tüm ilçeler'||maxPrice?1:0}</span></button><button className="sort-button" onClick={()=>notify('Portföyler en yeni eklenene göre sıralandı')}><ArrowDown size={15}/> En yeni <ChevronDown size={14}/></button><button className="view-button" onClick={()=>notify('Liste görünümü hazır')}><MoreHorizontal size={18}/></button></div>
          {filtersOpen && <div className="filter-panel"><label>İlçe<select value={selectedDistrict} onChange={e=>setSelectedDistrict(e.target.value)}><option>Tüm ilçeler</option>{[...new Set(properties.map(p=>p.district))].map(d=><option key={d}>{d}</option>)}</select></label><label>En yüksek fiyat<input type="number" placeholder="Örn. 5.000.000" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)}/></label><button className="clear-filter" onClick={()=>{setSelectedDistrict('Tüm ilçeler');setMaxPrice('')}}>Temizle</button></div>}
          <div className="results-label">{tab.toLocaleUpperCase('tr')} İLANLARI <span>{filtered.length} sonuç</span></div>
          <div className="property-grid">{filtered.map(p=><PropertyCard key={p.id} property={p} onOpen={()=>setModal(`property:${p.id}`)} onFavorite={()=>notify('Favorilere eklendi')} onShare={()=>{navigator.clipboard?.writeText(`${window.location.origin}/ilan/${p.id}`);notify('Paylaşım linki kopyalandı')}} />)}{!filtered.length && <div className="empty-state"><Building2 size={32}/><b>Bu aramada ilan bulunamadı</b><span>Arama veya filtre kriterlerini değiştirin.</span></div>}</div>
          <div className="list-footer">Tüm sonuçlar yüklendi <span>⌂</span></div>
        </> : <GenericPage page={page} openModal={setModal} notify={notify} refreshKey={refreshKey} />}
      </div>
      <footer className="footer"><span>© 2026 Aras Emlak Yönetim Sistemi</span><span>Verileriniz güvenle saklanır <span className="footer-dot">·</span> Yardım</span></footer>
    </main>
    {modal==='listing' && <ListingModal onClose={()=>setModal('')} onSave={addListing} notify={notify}/> }
    {modal==='login' && <LoginModal onClose={()=>setModal('')} onLogin={async(email,password,mode,setupCode)=>{if(!supabase){notify('Supabase bağlantısı için .env.local dosyasını doldurun');return}if(mode==='signup'&&setupCode)sessionStorage.setItem('emlak_platform_setup_code',setupCode);const result=mode==='signup'?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});if(result.error){sessionStorage.removeItem('emlak_platform_setup_code');notify(result.error.message)}else if(mode==='signup'&&!result.data.session){setModal('');notify('E-posta adresinizi doğrulayın; ardından giriş yapınca hesap kurulumu tamamlanır.')}else setModal('')}} />}
    {modal==='office' && <OfficeModal onClose={()=>setModal('')} onSave={createOffice}/>}
    {['client','owner','appointment','task'].includes(modal) && <RecordModal kind={modal} onClose={()=>setModal('')} onSave={form=>saveRecord(modal,form)}/>}
    {modal.startsWith('property:') && <PropertyModal property={properties.find(p=>p.id===modal.split(':')[1])} onClose={()=>setModal('')} onShare={()=>shareListing(modal.split(':')[1])}/>}
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

function PublicListing({token}) {
  const [listing,setListing] = useState(null)
  const [loading,setLoading] = useState(true)
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.rpc('get_public_listing',{share_token:token}).then(({data})=>{setListing(data);setLoading(false)})
  },[token])
  if (loading) return <div className="public-state">İlan yükleniyor…</div>
  if (!listing) return <div className="public-state"><Building2 size={28}/><h1>İlan bulunamadı</h1><p>Bağlantı geçersiz veya ilan artık yayında değil.</p></div>
  return <main className="public-listing"><header><div className="brand-mark"><Building2 size={19}/></div><b>{(listing.company_name||'Aras Emlak').toLocaleUpperCase('tr')}</b><span>Gayrimenkul ofisi</span></header><div className="public-card"><div className="public-cover" style={{backgroundImage:`url(${listing.photos?.[0]?.url || propertiesSeed[0].image})`}}/><div className="public-content"><div className="eyebrow">{listing.listing_type==='sale'?'SATILIK':'KİRALIK'} · {kindLabels[listing.property_type]||listing.property_type}</div><h1>{listing.title}</h1><p className="public-location"><MapPin size={15}/>{[listing.neighborhood,listing.district,listing.province].filter(Boolean).join(', ')}</p><div className="public-price">{money(listing.price)}{listing.listing_type==='rent'&&<small> / ay</small>}</div><div className="public-facts"><span><Ruler/>{listing.area_sqm||'—'} m²</span><span><BedDouble/>{listing.room_count||'—'}</span><span><Building2/>{listing.building_age==null?'—':`${listing.building_age} yaş`}</span></div><h2>İlan detayları</h2><p className="public-description">{listing.description||'Bu ilan için açıklama eklenmemiş.'}</p>{listing.features?.length>0&&<div className="public-features">{listing.features.map((f,i)=><span key={i}><Check size={14}/>{f}</span>)}</div>}<div className="public-contact"><b>Bu ilan hakkında bilgi alın</b><span>İletişim bilgileri Aras Emlak tarafından eklenecektir.</span></div></div></div><footer>© 2026 Aras Emlak · Gayrimenkul bilgileri paylaşım tarihinde geçerlidir.</footer></main>
}

function Dashboard({properties,stats,setPage,openModal}) {
  return <>
    <section className="welcome-row"><div><div className="eyebrow">{new Intl.DateTimeFormat('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Istanbul'}).format(new Date()).toLocaleUpperCase('tr')}</div><h1>Gününüz güzel geçsin, Özkan 👋</h1><p>Ofisinizde bugün olup bitenlere göz atın.</p></div><button className="primary-button" onClick={()=>openModal('listing')}><Plus size={18}/> Portföy ekle</button></section>
    <section className="stat-grid"><StatCard icon={Building2} label="Aktif portföy" value={stats?stats.properties:24} delta={stats?'Ofisinizdeki aktif ilan':'Son 30 günde +4'} color="blue"/><StatCard icon={Users} label="Aktif müşteri" value={stats?stats.clients:38} delta={stats?'Ofisinizin müşteri kayıtları':'Son 30 günde +8'} color="purple"/><StatCard icon={CalendarDays} label="Bu haftaki randevu" value={stats?stats.appointments:7} delta={stats?'Önümüzdeki 7 gün':'Bugün 2 randevu'} color="orange"/><StatCard icon={Eye} label="İlan görüntüleme" value={stats?stats.views:1284} delta={stats?'Paylaşım bağlantıları':'Geçen haftaya göre %12'} color="green"/></section>
    {!stats && <section className="dashboard-columns"><div className="panel today-panel"><div className="panel-heading"><div><h2>Bugünün planı</h2><p>Öncelikli işlerin ve yaklaşan randevuların</p></div><button className="text-button" onClick={()=>setPage('İş Takibi')}>Tümünü gör <ArrowRight size={15}/></button></div><div className="timeline"><div className="timeline-time">10:30</div><div className="timeline-line"><span/></div><div className="timeline-event"><div className="event-title">Daire gösterimi <span className="event-badge blue">Randevu</span></div><div className="event-sub"><b>Elif Yılmaz</b> ile · Bostanlı, 2+1 daire</div></div><button className="event-more"><MoreHorizontal size={17}/></button></div><div className="timeline"><div className="timeline-time">13:00</div><div className="timeline-line"><span className="orange-dot"/></div><div className="timeline-event"><div className="event-title">Mal sahibi aranacak <span className="event-badge orange">Hatırlatma</span></div><div className="event-sub"><b>Mehmet Kaya</b> · Yeni portföy görüşmesi</div></div><button className="event-more"><MoreHorizontal size={17}/></button></div><div className="timeline"><div className="timeline-time">15:30</div><div className="timeline-line"><span className="purple-dot"/></div><div className="timeline-event"><div className="event-title">Satış görüşmesi <span className="event-badge purple">Görüşme</span></div><div className="event-sub"><b>Deniz Arslan</b> ile · Ofiste</div></div><button className="event-more"><MoreHorizontal size={17}/></button></div><button className="add-task" onClick={()=>setPage('İş Takibi')}><Plus size={16}/> Yeni iş ekle</button></div>
    <div className="panel match-panel"><div className="panel-heading"><div><div className="match-title"><span className="sparkle"><Sparkles size={15}/></span><h2>Yeni portföye uygun müşteriler</h2></div><p>Son eklenen ilanlara göre eşleşenler</p></div><span className="match-count">3 eşleşme</span></div><div className="match-item"><div className="match-avatar av-purple">EY</div><div className="match-info"><b>Elif Yılmaz</b><span>Bornova · 3+1 · 6,5M TL bütçe</span></div><span className="match-percent">%96</span><button className="match-action"><MessageCircle size={16}/></button></div><div className="match-item"><div className="match-avatar av-green">DA</div><div className="match-info"><b>Deniz Arslan</b><span>İzmir · 2+1 veya 3+1 · 7M TL</span></div><span className="match-percent">%88</span><button className="match-action"><MessageCircle size={16}/></button></div><div className="match-item"><div className="match-avatar av-orange">BK</div><div className="match-info"><b>Burak Koç</b><span>Urla · Arsa · 8M TL bütçe</span></div><span className="match-percent">%81</span><button className="match-action"><MessageCircle size={16}/></button></div><button className="see-all" onClick={()=>setPage('Müşteriler')}>Tüm eşleşmeleri görüntüle <ArrowRight size={15}/></button></div></section>}
    {!stats ? <section className="panel recent-panel"><div className="panel-heading"><div><h2>Son eklenen portföyler</h2><p>Ofisinizin en güncel ilanları</p></div><button className="text-button" onClick={()=>setPage('Portföyler')}>Tüm portföyler <ArrowRight size={15}/></button></div><div className="recent-grid">{properties.slice(0,3).map(p=><PropertyCard compact key={p.id} property={p} onOpen={()=>setPage('Portföyler')}/>)}</div></section>:<section className="panel recent-panel"><div className="panel-heading"><div><h2>Son eklenen portföyler</h2><p>Ofisinizin en güncel ilanları</p></div><button className="text-button" onClick={()=>setPage('Portföyler')}>Tüm portföyler <ArrowRight size={15}/></button></div>{properties.length?<div className="recent-grid">{properties.slice(0,3).map(p=><PropertyCard compact key={p.id} property={p} onOpen={()=>setPage('Portföyler')}/>)}</div>:<p className="dashboard-empty">İlk ilanınızı ekleyince burada göreceksiniz.</p>}</section>}
  </>
}
function StatCard({icon:Icon,label,value,delta,color}) {return <div className="stat-card"><div className={`stat-icon ${color}`}><Icon size={19}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-delta"><ArrowUpRight size={13}/>{delta}</div></div>}
function PropertyCard({property:p,onOpen,onFavorite=()=>{},onShare=()=>{},compact=false}) {return <article className={`property-card ${compact?'compact':''}`}><div className="property-photo" onClick={onOpen} style={{backgroundImage:`url(${p.image})`}}><span className={`listing-tag ${p.type==='Satılık'?'sale-tag':'rent-tag'}`}>{p.type}</span><button className="photo-heart" onClick={e=>{e.stopPropagation();onFavorite()}}><Heart size={16}/></button><span className="photo-badge">{p.badge||'Yeni portföy'}</span></div><div className="property-content"><div className="property-area"><MapPin size={13}/>{p.neighborhood || `${p.district} · İzmir`}</div><h3 onClick={onOpen}>{p.title}</h3><div className="property-meta"><span><BedDouble size={15}/>{p.rooms}</span><span><Ruler size={15}/>{p.area} m²</span><span><LandPlot size={15}/>{p.kind}</span></div><div className="property-bottom"><div><strong>{money(p.price)}</strong><span>{p.type==='Kiralık'?' / ay':' · Satılık'}</span></div><button className="card-more" onClick={onShare}><ArrowUpRight size={17}/></button></div></div></article>}
function GenericPage({page,openModal,notify,refreshKey}) {
 const [rows,setRows]=useState([]),[search,setSearch]=useState(''),[loading,setLoading]=useState(false)
 const tableMap={'Müşteriler':'clients','Mal Sahipleri':'owners','Randevular':'appointments','İş Takibi':'tasks'}
 const titleMap={'Müşteriler':'Müşteri takibi','Mal Sahipleri':'Mal sahipleri','Randevular':'Randevu takvimi','İş Takibi':'Günlük iş takibi','Danışmanlar':'Danışman yönetimi','Raporlar':'Ofis raporları','Ayarlar':'Ofis ayarları'}
 const descMap={'Müşteriler':'Alıcı ve kiracı adaylarınızı, aradıkları özellikleriyle birlikte takip edin.','Mal Sahipleri':'Portföy sahiplerinin iletişim bilgileri ve görüşme notları.','Randevular':'Ev gösterimlerini ve ofis görüşmelerini planlayın.','İş Takibi':'Aramalar, hatırlatmalar ve tamamlanacak işler.','Danışmanlar':'Ofis ekibinizi ve erişim yetkilerini yönetin.','Raporlar':'Portföy ve müşteri hareketlerini takip edin.','Ayarlar':'Ofis bilgilerinizi ve uygulama tercihlerini düzenleyin.'}
 const kind=page==='Randevular'?'appointment':page==='Müşteriler'?'client':page==='Mal Sahipleri'?'owner':'task'
 useEffect(()=>{const table=tableMap[page];if(!supabase||!table){setRows([]);return}setLoading(true);supabase.from(table).select('*').order('created_at',{ascending:false}).limit(100).then(({data,error})=>{if(error)notify(error.message);setRows(data||[]);setLoading(false)})},[page,refreshKey])
 const visible=rows.filter(row=>JSON.stringify(row).toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')))
 const details=row=>{
  if(page==='Müşteriler')return <><strong>{row.full_name}</strong><span>{row.phone} · {row.preferred_listing_type==='sale'?'Satılık arıyor':row.preferred_listing_type==='rent'?'Kiralık arıyor':'Talep bilgisi yok'}</span></>
  if(page==='Mal Sahipleri')return <><strong>{row.full_name}</strong><span>{row.phone}{row.notes?' · '+row.notes:''}</span></>
  if(page==='Randevular')return <><strong>{new Date(row.starts_at).toLocaleString('tr-TR',{dateStyle:'medium',timeStyle:'short'})}</strong><span>{row.location||'Konum eklenmedi'}{row.notes?' · '+row.notes:''}</span></>
  return <><strong>{row.title}</strong><span>{row.due_at?new Date(row.due_at).toLocaleString('tr-TR',{dateStyle:'medium',timeStyle:'short'}):'Tarih belirlenmedi'}{row.notes?' · '+row.notes:''}</span></>
 }
 const addLabel=page==='Randevular'?'Randevu ekle':page==='Müşteriler'?'Müşteri ekle':page==='Mal Sahipleri'?'Mal sahibi ekle':'Yeni iş ekle'
 return <><section className="page-heading"><div><div className="eyebrow">ARAS EMLAK</div><h1>{titleMap[page]||page}</h1><p>{descMap[page]}</p></div>{tableMap[page]&&<button className="primary-button" onClick={()=>openModal(kind)}><Plus size={18}/>{addLabel}</button>}</section>
 {tableMap[page]?<><div className="generic-toolbar"><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={page+' içinde ara...'}/></div><span className="view-total">{visible.length} kayıt</span></div><div className="record-list">{loading?<div className="record-empty">Kayıtlar yükleniyor…</div>:visible.length?visible.map(row=><div className="record-row" key={row.id}><div className="record-mark">{page==='Müşteriler'?<Users size={17}/>:page==='Mal Sahipleri'?<Home size={17}/>:page==='Randevular'?<CalendarDays size={17}/>:<ClipboardList size={17}/>}</div><div className="record-info">{details(row)}</div>{row.phone&&<a className="record-call" href={'tel:'+row.phone}>Ara</a>}</div>):<div className="record-empty"><div className="empty-illustration"><Building2 size={24}/></div><b>{rows.length?'Sonuç bulunamadı':page+' kaydı yok'}</b><span>{rows.length?'Arama metnini değiştirebilirsiniz.':'Yeni bir kayıt ekleyerek başlayın.'}</span>{!rows.length&&<button className="secondary-button" onClick={()=>openModal(kind)}><Plus size={15}/> İlk kaydı ekle</button>}</div>}</div></>:<div className="panel empty-table"><div className="empty-illustration"><Building2 size={24}/></div><h2>{titleMap[page]} ekranı hazırlanıyor</h2><p>{descMap[page]}</p></div>}</>
}
function ListingModal({onClose,onSave,notify}) {
  const [form,setForm]=useState({type:'Satılık',kind:'Daire',title:'',province_id:'45',district_id:'',district:'',neighborhood:'',rooms:'3+1',area:'',price:'',description:''})
  const [provinces,setProvinces]=useState([])
  const [districts,setDistricts]=useState([])
  const [districtLoading,setDistrictLoading]=useState(false)
  const [neighborhoods,setNeighborhoods]=useState([])
  const [neighborhoodLoading,setNeighborhoodLoading]=useState(false)
  const update=(key,value)=>setForm(current=>({...current,[key]:value}))

  useEffect(()=>{
    if(!supabase){notify('İl ve ilçe listesi için veritabanı bağlantısı gerekli.');return}
    let active=true
    supabase.from('provinces').select('id,name').order('name').then(({data,error})=>{
      if(!active)return
      if(error)notify('İl listesi alınamadı: '+error.message)
      setProvinces(data||[])
    })
    return()=>{active=false}
  },[])

  useEffect(()=>{
    if(!supabase||!form.province_id){setDistricts([]);setDistrictLoading(false);return}
    let active=true
    setDistrictLoading(true)
    supabase.from('districts').select('id,name').eq('province_id',Number(form.province_id)).order('name')
      .then(({data,error})=>{
        if(!active)return
        if(error)notify('İlçe listesi alınamadı: '+error.message)
        setDistricts(data||[])
        setDistrictLoading(false)
      })
    return()=>{active=false}
  },[form.province_id])

  useEffect(()=>{
    if(String(form.province_id)!=='45'||!form.district_id||!supabase){
      setNeighborhoods([])
      setNeighborhoodLoading(false)
      return
    }
    let active=true
    setNeighborhoodLoading(true)
    supabase.from('neighborhoods').select('id,name').eq('district_id',Number(form.district_id)).order('name')
      .then(({data,error})=>{
        if(!active)return
        if(error)notify('Mahalle listesi alınamadı: '+error.message)
        setNeighborhoods(data||[])
        setNeighborhoodLoading(false)
      })
    return()=>{active=false}
  },[form.province_id,form.district_id])

  const isManisa=String(form.province_id)==='45'
  return <ModalShell title="Yeni portföy ekle" subtitle="Gayrimenkul bilgilerini girerek ofis portföyünüze ekleyin." onClose={onClose}>
    <div className="form-grid">
      <label className="span-two">İlan türü <div className="segmented"><button className={form.type==='Satılık'?'on':''} onClick={()=>update('type','Satılık')}>Satılık</button><button className={form.type==='Kiralık'?'on':''} onClick={()=>update('type','Kiralık')}>Kiralık</button></div></label>
      <label>Gayrimenkul türü<select value={form.kind} onChange={e=>update('kind',e.target.value)}>{['Daire','Villa','Arsa','Tarla','İş yeri','Müstakil ev','Diğer'].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>İlan başlığı<input required placeholder="Örn. Deniz manzaralı 3+1" value={form.title} onChange={e=>update('title',e.target.value)}/></label>
      <label>İl<select value={form.province_id} onChange={e=>{update('province_id',e.target.value);update('district_id','');update('district','');update('neighborhood','')}}>{provinces.length?provinces.map(p=><option key={p.id} value={p.id}>{p.name}</option>):<option value="45">Manisa</option>}</select></label>
      <label>İlçe<select value={form.district_id} disabled={!form.province_id||districtLoading} onChange={e=>{const d=districts.find(item=>String(item.id)===e.target.value);update('district_id',e.target.value);update('district',d?.name||'');update('neighborhood','')}}><option value="">{districtLoading?'İlçeler yükleniyor…':'İlçe seçin'}</option>{districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label>Mahalle{isManisa?<select value={form.neighborhood} disabled={!form.district_id||neighborhoodLoading} onChange={e=>update('neighborhood',e.target.value)}><option value="">{neighborhoodLoading?'Mahalleler yükleniyor…':form.district_id?(neighborhoods.length?'Mahalle seçin':'Bu ilçede mahalle bulunamadı'):'Önce ilçe seçin'}</option>{neighborhoods.map(n=><option key={n.id} value={n.name}>{n.name}</option>)}</select>:<input placeholder="Mahalle" value={form.neighborhood} onChange={e=>update('neighborhood',e.target.value)}/>}</label>
      <label>Oda sayısı<select value={form.rooms} onChange={e=>update('rooms',e.target.value)}>{['Stüdyo','1+1','2+1','3+1','4+1','5+1','—'].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Metrekare<input type="number" placeholder="m²" value={form.area} onChange={e=>update('area',e.target.value)}/></label>
      <label>Fiyat (₺)<input type="number" placeholder="TL" value={form.price} onChange={e=>update('price',e.target.value)}/></label>
      <label className="span-two">Açıklama<textarea rows="3" placeholder="Gayrimenkulün öne çıkan özelliklerini yazın..." value={form.description} onChange={e=>update('description',e.target.value)}/></label>
      <div className="span-two photo-upload"><Plus size={18}/><div><b>Fotoğraf ekleyin</b><span>Fotoğraflarınızı portföyü kaydettikten sonra yükleyebilirsiniz.</span></div></div>
    </div>
    <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Vazgeç</button><button className="primary-button" disabled={!form.title||!form.price||(isManisa&&(!form.district_id||!form.neighborhood))} onClick={()=>onSave(form)}><Check size={16}/> Portföyü kaydet</button></div>
  </ModalShell>
}
function RecordModal({kind,onClose,onSave}) {
 const initialDate=new Date(Date.now()+60*60*1000);initialDate.setMinutes(Math.ceil(initialDate.getMinutes()/15)*15,0,0)
 const [form,setForm]=useState({full_name:'',phone:'',email:'',budget_min:'',budget_max:'',preferred_listing_type:'sale',location:'',starts_at:new Date(initialDate.getTime()-initialDate.getTimezoneOffset()*60000).toISOString().slice(0,16),reminder_minutes:'60',title:'',due_at:'',notes:''})
 const update=(key,value)=>setForm(x=>({...x,[key]:value}))
 const titles={client:'Yeni müşteri ekle',owner:'Yeni mal sahibi ekle',appointment:'Yeni randevu ekle',task:'Yeni iş oluştur'}
 const required=kind==='client'||kind==='owner'?form.full_name&&form.phone:kind==='appointment'?form.starts_at:form.title
 return <ModalShell title={titles[kind]} subtitle="Bilgileri ofis kayıtlarına ekleyin." onClose={onClose}><div className="form-grid">
 {kind==='client'&&<><label className="span-two">Müşteri adı soyadı<input value={form.full_name} onChange={e=>update('full_name',e.target.value)} placeholder="Ad soyad"/></label><label>Telefon<input value={form.phone} onChange={e=>update('phone',e.target.value)} placeholder="+90 5xx xxx xx xx"/></label><label>E-posta<input type="email" value={form.email} onChange={e=>update('email',e.target.value)} placeholder="E-posta adresi"/></label><label>En düşük bütçe (₺)<input type="number" value={form.budget_min} onChange={e=>update('budget_min',e.target.value)}/></label><label>En yüksek bütçe (₺)<input type="number" value={form.budget_max} onChange={e=>update('budget_max',e.target.value)}/></label><label className="span-two">İlan türü<select value={form.preferred_listing_type} onChange={e=>update('preferred_listing_type',e.target.value)}><option value="sale">Satılık arıyor</option><option value="rent">Kiralık arıyor</option></select></label></>}
 {kind==='owner'&&<><label className="span-two">Mal sahibi adı soyadı<input value={form.full_name} onChange={e=>update('full_name',e.target.value)} placeholder="Ad soyad"/></label><label>Telefon<input value={form.phone} onChange={e=>update('phone',e.target.value)} placeholder="+90 5xx xxx xx xx"/></label><label>E-posta<input type="email" value={form.email} onChange={e=>update('email',e.target.value)} placeholder="E-posta adresi"/></label></>}
 {kind==='appointment'&&<><label>Randevu zamanı<input type="datetime-local" value={form.starts_at} onChange={e=>update('starts_at',e.target.value)}/></label><label>Hatırlatma<select value={form.reminder_minutes} onChange={e=>update('reminder_minutes',e.target.value)}><option value="15">15 dakika önce</option><option value="30">30 dakika önce</option><option value="60">1 saat önce</option><option value="1440">1 gün önce</option></select></label><label className="span-two">Görüşme yeri<input value={form.location} onChange={e=>update('location',e.target.value)} placeholder="Adres veya ofis"/></label></>}
 {kind==='task'&&<><label className="span-two">Yapılacak iş<input value={form.title} onChange={e=>update('title',e.target.value)} placeholder="Örn. Mal sahibini ara"/></label><label className="span-two">Son tarih ve saat<input type="datetime-local" value={form.due_at} onChange={e=>update('due_at',e.target.value)}/></label></>}
 {kind!=='client'&&<label className="span-two">Not<textarea rows="3" value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder="Görüşme veya kayıt notu"/></label>}
 {kind==='client'&&<label className="span-two">Özel not<textarea rows="3" value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder="Müşteri tercihleri ve özel notlar"/></label>}
 </div><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Vazgeç</button><button className="primary-button" disabled={!required} onClick={()=>onSave(form)}><Check size={16}/> Kaydet</button></div></ModalShell>
}
function AdminOfficesPage({refreshKey,openModal}) {
 const [offices,setOffices]=useState([]),[loading,setLoading]=useState(true)
 useEffect(()=>{if(!supabase)return;setLoading(true);supabase.from('companies').select('id,name,admin_email,subscription_status,subscription_plan,created_at').order('created_at',{ascending:false}).then(({data})=>{setOffices(data||[]);setLoading(false)})},[refreshKey])
 return <><section className="page-heading"><div><div className="eyebrow">PLATFORM YÖNETİMİ</div><h1>Emlak ofisleri</h1><p>Sisteme katılan ofisleri yalnızca platform yöneticisi oluşturabilir.</p></div><button className="primary-button" onClick={()=>openModal('office')}><Plus size={18}/> Ofis aç</button></section><div className="record-list">{loading?<div className="record-empty">Ofisler yükleniyor…</div>:offices.map(office=><div className="record-row" key={office.id}><div className="record-mark"><Building2 size={17}/></div><div className="record-info"><strong>{office.name}</strong><span>{office.admin_email||'İlk yönetici Aras platform hesabı'} · {office.subscription_plan} · {office.subscription_status}</span></div><span className="office-created">{new Date(office.created_at).toLocaleDateString('tr-TR')}</span></div>)}{!loading&&!offices.length&&<div className="record-empty">Henüz ofis yok.</div>}</div><p className="admin-hint">Ofis oluştururken bir başlangıç yöneticisi e-postası girin. Bu kişi hesap açıp e-postasını doğrulayarak giriş yaptığında ofis yöneticisi olur.</p></>
}
function LoginModal({onClose,onLogin}) {const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[setupCode,setSetupCode]=useState(''),[mode,setMode]=useState('login');return <ModalShell title={mode==='login'?'Hesabınıza giriş yapın':'Hesap oluşturun'} subtitle="Ofislerin açılması platform yöneticisinin yetkisindedir." onClose={onClose}><div className="form-grid">{mode==='signup'&&<label className="span-two">İlk platform yöneticisi kurulum kodu <input type="password" autoComplete="off" placeholder="İlk yöneticiyseniz kodu girin" value={setupCode} onChange={e=>setSetupCode(e.target.value)}/></label>}<label className="span-two">E-posta<input type="email" placeholder="ad@ofis.com" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="span-two">Şifre<input type="password" placeholder="En az 8 karakter" value={password} onChange={e=>setPassword(e.target.value)}/></label></div><div className="modal-actions"><button className="secondary-button" onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Hesap oluştur':'Giriş ekranı'}</button><button className="primary-button" onClick={()=>onLogin(email,password,mode,setupCode)}>{mode==='login'?'Giriş yap':'Hesabı oluştur'}</button></div><p className="form-footnote">Yeni hesaplar ofis oluşturamaz. Ofis yöneticileri platform yöneticisinin belirlediği e-posta adresiyle hesap açar.</p></ModalShell>}
function OfficeModal({onClose,onSave}) {const [name,setName]=useState(''),[adminEmail,setAdminEmail]=useState('');return <ModalShell title="Yeni emlak ofisi aç" subtitle="Ofis hesabını ve başlangıç yöneticisini tanımlayın." onClose={onClose}><div className="form-grid"><label className="span-two">Ofis adı<input value={name} onChange={e=>setName(e.target.value)} placeholder="Örn. Aras Emlak"/></label><label className="span-two">Ofis yöneticisi e-posta adresi<input type="email" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} placeholder="yonetici@ofis.com"/></label></div><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Vazgeç</button><button className="primary-button" disabled={!name||!adminEmail} onClick={()=>onSave({name,admin_email:adminEmail})}><Check size={16}/> Ofisi oluştur</button></div></ModalShell>}
function PropertyModal({property:p,onClose,onShare}) {if(!p)return null;return <ModalShell title={p.title} subtitle={`${p.district} · ${p.neighborhood||'İzmir'}`} onClose={onClose}><div className="detail-image" style={{backgroundImage:`url(${p.image})`}}/><div className="detail-price">{money(p.price)} <span>{p.type==='Kiralık'?'/ ay':'· Satılık'}</span></div><div className="detail-metrics"><span><BedDouble/>{p.rooms}</span><span><Ruler/>{p.area} m²</span><span><Building2/>{p.kind}</span></div><p className="detail-description">{p.description||'İlan açıklaması henüz eklenmedi. Detaylı bilgi için portföy kaydını düzenleyin.'}</p><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Kapat</button><button className="primary-button" onClick={onShare}><ArrowUpRight size={16}/> Paylaşım linkini kopyala</button></div></ModalShell>}
function ModalShell({title,subtitle,onClose,children}) {return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose}><X size={18}/></button></div>{children}</div></div>}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
