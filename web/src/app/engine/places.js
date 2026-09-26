// Place -> country resolution for Atlas colouring and birthplace statistics.
// resolveCountry(place) reads the LAST meaningful comma part first, then scans the others
// right to left. ALIASES maps a normalised name to { country, region, ambiguous, candidates }.
// Pure JS, no DOM.

/**
 * @typedef {{ country: string|null, region: string|null, ambiguous?: boolean, candidates?: string[], code?: boolean }} AliasEntry
 */

/**
 * Normalise a place part for lookup: accents folded, lower case, periods dropped,
 * punctuation to spaces, leading "the" removed.
 * @param {string} s
 * @returns {string}
 */
export function normalizePlaceKey(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036F]/g, '')
    .replace(/[øØ]/g, 'o').replace(/[æÆ]/g, 'ae').replace(/ß/g, 'ss').replace(/[đĐðÐ]/g, 'd')
    .replace(/[łŁ]/g, 'l').replace(/[þÞ]/g, 'th').replace(/[œŒ]/g, 'oe').replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[-_'’‘`´/\\:;"“”«»&+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

// ---------------------------------------------------------------------------------------------
// Alias data. One line per entry:
//   Country | alias | alias ...                  a country (region null)
//   Country > Region | alias | alias ...         a region of a country
//   ? Label > Cand1, Cand2 | alias | alias ...   ambiguous: the user assigns it (country null)
// An alias starting with ^ is an abbreviation code: it only matches when written in capitals
// or with a period ("MA", "Pa.", "N.Y."), so ordinary words never match by accident.
// The first alias after the label is implied by the label itself.

const COUNTRIES = `
United States | usa | ^us | u s | u s a | united states of america | america | amerika | estados unidos | etats unis | vereinigte staaten | stati uniti | verenigde staten | forente stater | forenede stater | forenta staterna | stany zjednoczone | spojene staty | yhdysvallat | untied states | unites states | united state | us of a | united states america | u s of a | usa america | colonial america | british america | british colonial america | thirteen colonies | american colonies | confederate states | confederate states of america | new england
United Kingdom | ^uk | u k | great britain | britain | ^gb | g b | united kingdom of great britain | united kingdom of great britain and ireland | grossbritannien | grande bretagne | gran bretana | storbritannien | storbritannia | groot brittannie | reino unido | regno unito | royaume uni | vereinigtes konigreich | wielka brytania | velka britanie | isle of britain
Ireland | eire | irland | irlande | irlanda | ierland | irlandia | irsko | republic of ireland | irish free state | saorstat eireann | erin | ireland republic | southern ireland | airlann
Isle of Man | mann | ellan vannin
Jersey
Guernsey | channel islands | alderney | sark
Germany | deutschland | allemagne | germania | alemania | alemanha | duitsland | tyskland | niemcy | nemecko | saksa | nemetorszag | germanija | west germany | east germany | brd | ddr | frg | gdr | federal republic of germany | german democratic republic | bundesrepublik deutschland | deutsches reich | german reich | german empire | deutsches kaiserreich | kaiserreich | third reich | weimar republic | germany west | germany east | germanie | germay | germnay | north german confederation | norddeutscher bund
France | francia | frankreich | frankrijk | frankrike | frankrig | francja | francie | republique francaise | kingdom of france | royaume de france | french republic | ranska | franca | frankrijk
Netherlands | nederland | holland | niederlande | pays bas | paesi bassi | paises bajos | nizozemsko | holandia | alankomaat | kingdom of the netherlands | koninkrijk der nederlanden | batavian republic | dutch republic | united provinces | nederlanden | the netherlands | hollande
Belgium | belgie | belgique | belgien | belgio | belgica | koninkrijk belgie | royaume de belgique | belgia | austrian netherlands | southern netherlands | spanish netherlands
Luxembourg | letzebuerg | luxemburg | luxemburgo | lussemburgo | grand duchy of luxembourg
Switzerland | schweiz | suisse | svizzera | svizra | helvetia | confoederatio helvetica | zwitserland | suiza | szwajcaria | svycarsko | sveits | schweitz | swiss confederation | helvetic republic
Austria | osterreich | oesterreich | autriche | rakousko | austrija | ausztria | osterrike | ostrig | oostenrijk | republic of austria | archduchy of austria | erzherzogtum osterreich | itavalta | austria republic
Liechtenstein
Italy | italia | italien | italie | wlochy | kingdom of italy | regno d italia | italie | italija | olaszorszag | italia regno
Spain | espana | spanien | espagne | spagna | hiszpania | spanelsko | kingdom of spain | reino de espana | espanha | espanja
Portugal | portuguesa | republica portuguesa | reino de portugal | portugalia | portugalsko | portogallo | portugalska | kingdom of portugal
Andorra
Monaco
San Marino
Vatican City | holy see | vatican | citta del vaticano
Malta
Gibraltar
Denmark | danmark | danemark | daenemark | danimarca | dinamarca | dania | dansko | kingdom of denmark | tanska | danija
Faroe Islands | faroes | foroyar | faeroerne | faeroe islands | faroe
Greenland | kalaallit nunaat | gronland
Iceland | island | islande | islandia | lydveldid island
Norway | norge | noreg | norwegen | norvege | norvegia | noruega | norwegia | norsko | kingdom of norway | norja | norveg | norwey | norwary
Sweden | sverige | schweden | suede | svezia | suecia | szwecja | svedsko | kingdom of sweden | ruotsi | sveriges | sweeden | swedan
Finland | suomi | finnland | finlande | finlandia | grand duchy of finland | storfurstendomet finland | suomen suuriruhtinaskunta | finsko
Estonia | eesti | estland | estonie | estonsko | estonian ssr | esthonia
Latvia | latvija | lettland | lettonie | lotyssko | latvian ssr | lotwa
Lithuania | lietuva | litauen | lituanie | lituania | litwa | litva | lithuanian ssr
Poland | polska | polen | pologne | polonia | polsko | kingdom of poland | congress poland | krolestwo polskie | russian poland | prussian poland | austrian poland | lengyelorszag | puola | poland russia | poland prussia | second polish republic | polish peoples republic | duchy of warsaw
Czechia | czech republic | cesko | ceska republika | czech | tschechien | tschechische republik | republique tcheque | tchequie | czechy | czech lands | ceske zeme
Slovakia | slovensko | slowakei | slovaquie | slovacchia | eslovaquia | slovak republic | slowacja
Hungary | magyarorszag | ungarn | hongrie | ungheria | hungria | wegry | madarsko | kingdom of hungary | konigreich ungarn | unkari | hungarian kingdom | magyar kiralysag
Slovenia | slovenija | slowenien | slovenie | slovinsko | eslovenia
Croatia | hrvatska | kroatien | croatie | chorvatsko | croazia | kingdom of croatia | croatia slavonia | kingdom of croatia slavonia
Bosnia and Herzegovina | bosnia | herzegovina | bosna i hercegovina | bosnia herzegovina | bosnien | bosnien herzegowina | bosna
Serbia | srbija | србија | serbien | serbie | kingdom of serbia | srbsko | szerbia
Montenegro | crna gora | црна гора
Kosovo | kosova
Albania | shqiperia | shqiperi | albanien | albanie
North Macedonia | makedonija | fyrom | republic of macedonia | severna makedonija
Bulgaria | balgariya | bulgarien | bulgarie | българия | bulharsko | kingdom of bulgaria
Romania | rumanien | roumanie | rumunsko | rumania | kingdom of romania | rumunia | romanija
Moldova | republic of moldova | moldavian ssr
Greece | ellada | ellas | hellas | griechenland | grece | grecia | grecja | recko | kingdom of greece | hellenic republic | ελλάδα | ελλάς | ελλαδα | hellenic | kreikka | graecia
Cyprus | kypros | kibris | zypern | chypre | κύπρος | cipro
Turkey | turkiye | turkei | turquie | turchia | turcja | turecko | ottoman empire | osmanli | osmanli imparatorlugu | turkish republic | republic of turkey | osmanisches reich | empire ottoman | impero ottomano | ottoman turkey | turkey in asia | turkey in europe
Russia | rossiya | россия | russland | russie | rusia | rosja | rusko | russian federation | russian sfsr | rossia | venaja | russia federation
Ukraine | ukraina | україна | ukrajina | ukrainian ssr | ukraine ssr | ucraina | ukrajna
Belarus | беларусь | byelorussia | belorussia | white russia | weissrussland | bielorussia | byelorussian ssr | bielorus | bialorus
Georgia! | sakartvelo | republic of georgia | georgian ssr | საქართველო | georgien | georgie
Armenia | hayastan | armenien | armenie | armenian ssr | հայաստան
Azerbaijan | azerbaycan | aserbaidschan | azerbaidjan
Kazakhstan | qazaqstan | kasachstan
Uzbekistan
Turkmenistan
Kyrgyzstan | kirghizia | kyrgyz republic
Tajikistan
Canada | kanada | le canada | dominion of canada | province of canada | british north america | new france | nouvelle france | acadia | acadie | ruperts land | canda | cananda
Mexico | mexiko | mexique | messico | estados unidos mexicanos | meksyk | mehiko
Guatemala
Belize | british honduras
Honduras
El Salvador | salvador
Nicaragua
Costa Rica
Panama
Cuba
Jamaica
Haiti | saint domingue | st domingue
Dominican Republic | republica dominicana | santo domingo
Puerto Rico | porto rico
Bahamas
Barbados
Trinidad and Tobago | trinidad | tobago
Grenada
Saint Lucia | st lucia
Saint Vincent and the Grenadines | saint vincent | st vincent
Antigua and Barbuda | antigua
Dominica
Saint Kitts and Nevis | saint kitts | st kitts | nevis | st christopher
Bermuda
Cayman Islands
Guadeloupe
Martinique
Curacao | curaçao
Aruba
Colombia | kolumbien | colombie | new granada
Venezuela
Ecuador
Peru
Bolivia
Chile
Argentina | argentine | argentinien | republica argentina
Uruguay
Paraguay
Brazil | brasil | brasilien | bresil | brasile | brazylia | empire of brazil
Guyana | british guiana
Suriname | surinam | dutch guiana
French Guiana | guyane | guyane francaise
Falkland Islands | falklands | islas malvinas
Algeria | algerie | algerien | al jazair
Morocco | maroc | marokko | al maghrib | marruecos
Tunisia | tunisie | tunesien
Libya | libye | libyen | tripolitania | cyrenaica
Egypt | misr | agypten | egypte | egitto | egipto
Sudan | anglo egyptian sudan
South Sudan
Ethiopia | abyssinia | athiopien | ethiopie
Eritrea
Somalia | somaliland | italian somaliland | british somaliland
Kenya | british east africa
Uganda
Tanzania | tanganyika | zanzibar | german east africa
Rwanda
Burundi
Democratic Republic of the Congo | dr congo | drc | congo kinshasa | zaire | belgian congo | congo free state
Republic of the Congo | congo brazzaville | french congo | middle congo
Angola | portuguese west africa
Mozambique | mocambique | portuguese east africa
Zambia | northern rhodesia
Zimbabwe | southern rhodesia
Malawi | nyasaland
Botswana | bechuanaland
Namibia | south west africa | german south west africa
South Africa | suid afrika | union of south africa | cape colony | cape of good hope | natal | transvaal | orange free state | south african republic | zuid afrika | sudafrika | afrique du sud | rsa
Lesotho | basutoland
Eswatini | swaziland
Madagascar
Mauritius
Nigeria
Ghana | gold coast
Senegal
Sierra Leone
Liberia
Ivory Coast | cote d ivoire | cote divoire
Cameroon | cameroun | kamerun
Gabon
Mali | french sudan
Niger
Chad | tchad
Burkina Faso | upper volta
Benin | dahomey
Togo | togoland
Guinea
Guinea-Bissau | portuguese guinea
Gambia | the gambia
Cape Verde | cabo verde
Mauritania
Djibouti | french somaliland
Seychelles
Comoros
Equatorial Guinea | spanish guinea
Central African Republic | ubangi shari
Sao Tome and Principe | sao tome
Reunion | la reunion | ile bourbon
China | zhongguo | 中国 | 中國 | peoples republic of china | prc | chinese empire | qing empire | qing china | kina | chine | cina | chiny | cina | chinese | china mainland | mainland china | manchuria | canton | guangdong | kwangtung | fujian | fukien | peking | beijing | peiping | shanghai
Hong Kong | 香港 | hongkong
Macau | macao | 澳門 | 澳门
Taiwan | formosa | republic of china | 台灣 | 台湾
Japan | nippon | nihon | 日本 | japon | giappone | japonia | japonsko | empire of japan | tokyo | edo | yokohama | osaka | kyoto | hiroshima | okinawa
South Korea | republic of korea | 대한민국 | 한국 | hanguk | seoul
North Korea | dprk | 조선민주주의인민공화국 | pyongyang
Mongolia | mongolei | mongolie
Vietnam | viet nam | việt nam | vietnã | south vietnam | north vietnam | republic of vietnam | democratic republic of vietnam | saigon | sai gon | ho chi minh city | hanoi | ha noi | hai phong | haiphong | hue | da nang | tourane
Laos
Cambodia | kampuchea | cambodge | kambodscha
Thailand | siam | prathet thai | ประเทศไทย | bangkok
Myanmar | burma | birma | birmanie | rangoon | yangon
Malaysia | malaya | federated malay states | penang | kuala lumpur
Singapore | singapura
Indonesia | dutch east indies | netherlands east indies | nederlands indie | nederlandsch indie | java | sumatra | batavia | jakarta | borneo | celebes | sulawesi
Philippines | pilipinas | filipinas | philippine islands | phillipines | philipines | phillippines | manila | luzon | mindanao | visayas
Brunei
East Timor | timor leste | portuguese timor
India | bharat | भारत | hindustan | bombay | mumbai | calcutta | kolkata | madras | chennai | delhi | new delhi | goa | portuguese india
Pakistan | west pakistan | karachi | lahore
Bangladesh | east pakistan | east bengal | dhaka | dacca
Sri Lanka | ceylon | ceylan
Nepal
Bhutan
Maldives
Afghanistan
Iran | persia | persien | perse | persia iran | tehran | teheran
Iraq | mesopotamia | baghdad
Syria | syrie | syrien | suriyah | damascus
Lebanon | liban | libanon | beirut | beyrouth
Israel | ישראל | yisrael | medinat yisrael | tel aviv
Jordan | transjordan | hashemite kingdom of jordan
Saudi Arabia | hejaz | nejd
Yemen | aden
Oman | muscat
United Arab Emirates | uae | trucial states
Qatar
Bahrain
Kuwait
Australia | australien | australie | commonwealth of australia | ^aus | austrailia | australia commonwealth
New Zealand | aotearoa | new zeland | neuseeland | nouvelle zelande | ^nz
Fiji
Papua New Guinea | papua | new guinea
Samoa | western samoa
Tonga
`;

const REGIONS = `
United Kingdom > England | england | engeland | angleterre | inghilterra | inglaterra | anglia | englad | englnad | ^eng | englund | england uk | england gb | england united kingdom | england great britain
United Kingdom > Scotland | scotland | schottland | ecosse | scozia | escocia | szkocja | alba | scottland | skottland | scot | skotland | scotland uk
United Kingdom > Wales | wales | cymru | pays de galles | galles | walia | gales | wales uk
United Kingdom > Northern Ireland | northern ireland | nordirland | n ireland | ulster ni | irlande du nord
United Kingdom > England | bedfordshire | berkshire | buckinghamshire | cambridgeshire | cheshire | cornwall | cumberland | derbyshire | devon | devonshire | dorset | dorsetshire | durham | county durham | essex | gloucestershire | hampshire | herefordshire | hertfordshire | huntingdonshire | kent | lancashire | leicestershire | lincolnshire | middlesex | norfolk | northamptonshire | northumberland | nottinghamshire | oxfordshire | rutland | shropshire | salop | somerset | somersetshire | staffordshire | suffolk | surrey | sussex | east sussex | west sussex | warwickshire | westmorland | wiltshire | worcestershire | yorkshire | north yorkshire | west yorkshire | east yorkshire | south yorkshire | east riding of yorkshire | west riding of yorkshire | north riding of yorkshire | isle of wight | london | greater london | city of london | westminster | merseyside | greater manchester | west midlands | tyne and wear | cumbria | avon | manchester | liverpool | birmingham | bristol | leeds | sheffield | newcastle upon tyne | kensington | windsor
United Kingdom > Scotland | aberdeenshire | angus | forfarshire | argyll | argyllshire | ayrshire | banffshire | berwickshire | bute | caithness | clackmannanshire | dumfriesshire | dunbartonshire | dumbartonshire | east lothian | haddingtonshire | fife | inverness shire | invernessshire | kincardineshire | kinross shire | kirkcudbrightshire | lanarkshire | midlothian | edinburghshire | moray | elginshire | nairnshire | orkney | peeblesshire | perthshire | renfrewshire | ross and cromarty | ross shire | roxburghshire | selkirkshire | shetland | stirlingshire | sutherland | west lothian | linlithgowshire | wigtownshire | edinburgh | glasgow | aberdeen | dundee | highland | lothian | strathclyde | grampian | tayside
United Kingdom > Wales | anglesey | brecknockshire | breconshire | caernarvonshire | carnarvonshire | caernarfonshire | cardiganshire | carmarthenshire | denbighshire | flintshire | glamorgan | glamorganshire | merionethshire | monmouthshire | montgomeryshire | pembrokeshire | radnorshire | gwynedd | powys | dyfed | clwyd | gwent | cardiff | swansea
United Kingdom > Northern Ireland | belfast
Ireland > Munster | munster
Ireland > Leinster | leinster
Ireland > Connacht | connacht | connaught
Ireland > Ulster | ulster
Ireland > County Antrim | antrim
Ireland > County Armagh | armagh
Ireland > County Carlow | carlow
Ireland > County Cavan | cavan
Ireland > County Clare | clare
Ireland > County Cork | cork
Ireland > County Derry | derry | londonderry
Ireland > County Donegal | donegal | tyrconnell
Ireland > County Down | down
Ireland > County Dublin | dublin
Ireland > County Fermanagh | fermanagh
Ireland > County Galway | galway
Ireland > County Kerry | kerry
Ireland > County Kildare | kildare
Ireland > County Kilkenny | kilkenny
Ireland > County Laois | laois | leix | queens county | queens co
Ireland > County Leitrim | leitrim
Ireland > County Limerick | limerick
Ireland > County Longford | longford
Ireland > County Louth | louth
Ireland > County Mayo | mayo
Ireland > County Meath | meath
Ireland > County Monaghan | monaghan
Ireland > County Offaly | offaly | kings co
Ireland > County Roscommon | roscommon
Ireland > County Sligo | sligo
Ireland > County Tipperary | tipperary
Ireland > County Tyrone | tyrone
Ireland > County Waterford | waterford
Ireland > County Westmeath | westmeath
Ireland > County Wexford | wexford
Ireland > County Wicklow | wicklow
United States | carolina | province of carolina | carolinas | dakota | dakota territory
United States > Alabama | alabama | ^al | ala
United States > Alaska | alaska | ^ak | alas | alaska territory | territory of alaska
United States > Arizona | arizona | ^az | ariz | arizona territory
United States > Arkansas | arkansas | ^ar | ^ark | arkansas territory
United States > California | california | ^ca | calif | ^cal | alta california | los angeles | san francisco
United States > Colorado | colorado | ^co | colo | colorado territory
United States > Connecticut | connecticut | ^ct | conn | connecticut colony
United States > Delaware | delaware | ^de | ^del
United States > District of Columbia | district of columbia | ^dc | washington dc | washington d c | washington district of columbia
United States > Florida | florida | ^fl | fla | flor | florida territory
United States > Georgia | georgia | ^ga | province of georgia
United States > Hawaii | hawaii | hawai i | ^hi | territory of hawaii | kingdom of hawaii | hawaiian islands | sandwich islands
United States > Idaho | idaho | ^id | ^ida | idaho territory
United States > Illinois | illinois | ^il | ^ill | ^ills | chicago
United States > Indiana | indiana | ^in | ^ind | indiana territory
United States > Iowa | iowa | ^ia | iowa territory
United States > Kansas | kansas | ^ks | kan | kans | kansas territory
United States > Kentucky | kentucky | ^ky | ^ken
United States > Louisiana | louisiana | ^la | louisiana territory | orleans territory | new orleans
United States > Maine | maine | ^me | district of maine
United States > Maryland | maryland | ^md | province of maryland
United States > Massachusetts | massachusetts | ^ma | mass | massachusetts bay | massachusetts bay colony | province of massachusetts bay | plymouth colony | boston
United States > Michigan | michigan | ^mi | mich | michigan territory
United States > Minnesota | minnesota | ^mn | minn | minnesota territory
United States > Mississippi | mississippi | ^ms | ^miss | mississippi territory
United States > Missouri | missouri | ^mo | missouri territory
United States > Montana | montana | ^mt | ^mont | montana territory
United States > Nebraska | nebraska | ^ne | neb | nebr | nebraska territory
United States > Nevada | nevada | ^nv | nev | nevada territory
United States > New Hampshire | new hampshire | ^nh | province of new hampshire
United States > New Jersey | new jersey | ^nj | province of new jersey | east jersey | west jersey
United States > New Mexico | new mexico | ^nm | n mex | nmex | new mexico territory
United States > New York | new york | ^ny | new york state | province of new york | new netherland | nieuw nederland | new amsterdam | new york city | nyc | manhattan | brooklyn | bronx | queens | staten island
United States > North Carolina | north carolina | ^nc | n carolina | province of north carolina
United States > North Dakota | north dakota | ^nd | n dak | ndak
United States > Ohio | ohio | ^oh | ohio territory | northwest territory
United States > Oklahoma | oklahoma | ^ok | okla | indian territory | oklahoma territory
United States > Oregon | oregon | ^or | ^ore | oreg | oregon territory
United States > Pennsylvania | pennsylvania | ^pa | penn | penna | province of pennsylvania | pensylvania | pennsilvania | philadelphia | pittsburgh
United States > Rhode Island | rhode island | ^ri | rhode island and providence plantations | colony of rhode island
United States > South Carolina | south carolina | ^sc | s carolina | province of south carolina
United States > South Dakota | south dakota | ^sd | s dak | sdak
United States > Tennessee | tennessee | ^tn | tenn
United States > Texas | texas | ^tx | tex | republic of texas
United States > Utah | utah | ^ut | utah territory
United States > Vermont | vermont | ^vt | vermont republic
United States > Virginia | virginia | ^va | virginia colony | colony of virginia | old dominion
United States > Washington | washington | ^wa | ^wash | washington territory | washington state
United States > West Virginia | west virginia | ^wv | w va | wva
United States > Wisconsin | wisconsin | ^wi | wis | wisc | wisconsin territory
United States > Wyoming | wyoming | ^wy | wyo | wyoming territory
Canada > Ontario | ontario | ^on | ^ont | upper canada | canada west | toronto | ottawa
Canada > Quebec | quebec | ^qc | ^pq | ^que | lower canada | canada east | bas canada | montreal | quebec city
Canada > British Columbia | british columbia | ^bc | colombie britannique | vancouver
Canada > Alberta | alberta | ^ab | ^alta
Canada > Manitoba | manitoba | ^mb | ^man | assiniboia
Canada > Saskatchewan | saskatchewan | ^sk | sask
Canada > Nova Scotia | nova scotia | ^ns | nouvelle ecosse | cape breton | halifax
Canada > New Brunswick | new brunswick | ^nb | nouveau brunswick
Canada > Newfoundland and Labrador | newfoundland and labrador | newfoundland | ^nl | ^nf | nfld | terre neuve | labrador
Canada > Prince Edward Island | prince edward island | ^pe | pei | ile du prince edouard
Canada > Northwest Territories | northwest territories | ^nt | nwt | north west territories
Canada > Yukon | yukon | ^yt | yukon territory
Canada > Nunavut | nunavut | ^nu
Australia > New South Wales | new south wales | nsw | sydney
Australia > Victoria | victoria | victoria australia | melbourne | port phillip
Australia > Queensland | queensland | qld | brisbane
Australia > South Australia | south australia | adelaide
Australia > Western Australia | western australia | perth western australia
Australia > Tasmania | tasmania | van diemens land | hobart
Australia > Northern Territory | northern territory
Germany > Bavaria | bavaria | bayern | kingdom of bavaria | konigreich bayern | baviere | electorate of bavaria | upper bavaria | oberbayern | lower bavaria | niederbayern | franconia | franken | upper franconia | oberfranken | middle franconia | mittelfranken | lower franconia | unterfranken | upper palatinate | oberpfalz | swabia | schwaben | munich | munchen | nuremberg | nurnberg | ansbach | bayreuth | wurzburg | augsburg | regensburg | bamberg | kulmbach | oettingen
Germany > Wurttemberg | wurttemberg | wuerttemberg | kingdom of wurttemberg | konigreich wurttemberg | wurtemberg | duchy of wurttemberg | stuttgart | ludwigsburg | tubingen | obersontheim | hohenlohe
Germany > Baden | baden | grand duchy of baden | grossherzogtum baden | margraviate of baden | karlsruhe | durlach | mannheim | heidelberg | freiburg
Germany > Baden-Wurttemberg | baden wurttemberg | baden wuerttemberg
Germany > Saxony | saxony | sachsen | kingdom of saxony | konigreich sachsen | electorate of saxony | kursachsen | dresden | leipzig | chemnitz
Germany > Hanover | hanover | hannover | kingdom of hanover | konigreich hannover | electorate of hanover | brunswick luneburg | celle
Germany > Hesse | hesse | hessen | hesse darmstadt | hessen darmstadt | grand duchy of hesse | hesse kassel | hessen kassel | hesse cassel | electorate of hesse | kurhessen | hesse homburg | darmstadt | kassel | hanau | laubach | gedern | eschwege | waldeck | waldeck pyrmont | arolsen | bad arolsen | frankfurt | frankfurt am main | wiesbaden | nassau | duchy of nassau
Germany > Prussia | prussia | preussen | kingdom of prussia | konigreich preussen | prusse | prusy | prussian | brandenburg | mark brandenburg | berlin | potsdam | westphalia | westfalen | province of westphalia | rhineland | rheinland | rhine province | rheinprovinz | province of saxony | magdeburg | halle | halle saale
Germany > Palatinate | palatinate | pfalz | rheinpfalz | rhenish palatinate | electoral palatinate | kurpfalz
Germany > Mecklenburg | mecklenburg | mecklenburg schwerin | mecklenburg strelitz | schwerin | gustrow | neustrelitz | mirow | ludwigslust | rostock | wismar
Germany > Oldenburg | oldenburg | grand duchy of oldenburg | eutin
Germany > Brunswick | brunswick | braunschweig | duchy of brunswick | wolfenbuttel | wolfenbuettel | salzdahlum | bevern
Germany > Thuringia | thuringia | thuringen | thueringen | saxe coburg | saxe coburg gotha | sachsen coburg | sachsen coburg gotha | saxe gotha | saxe gotha altenburg | saxe weimar | sachsen weimar | saxe weimar eisenach | saxe meiningen | sachsen meiningen | saxe altenburg | sachsen altenburg | saxe hildburghausen | saxe saalfeld | saxe coburg saalfeld | schwarzburg rudolstadt | schwarzburg sondershausen | reuss | reuss greiz | reuss gera | reuss ebersdorf | reuss schleiz | reuss lobenstein | coburg | gotha | weimar | meiningen | altenburg | hildburghausen | saalfeld | rudolstadt | sondershausen | gera | greiz | schleiz | eisenach | arnstadt | erfurt | jena | ebersdorf | saalburg ebersdorf | lobenstein
Germany > Anhalt | anhalt | anhalt dessau | anhalt zerbst | anhalt bernburg | anhalt kothen | zerbst | dessau | kothen | bernburg | ballenstedt
Germany > Lippe | lippe | lippe detmold | schaumburg lippe | detmold | buckeburg
Germany > Schleswig-Holstein | schleswig holstein | holstein | lauenburg | saxe lauenburg | holstein gottorp | kiel | plon | gluckstadt
Germany > Hamburg | hamburg
Germany > Bremen | bremen
Germany > Lubeck | lubeck | luebeck
Germany > Saarland | saarland | saar
Germany > Lower Saxony | lower saxony | niedersachsen | east frisia | ostfriesland | aurich
Germany > North Rhine-Westphalia | north rhine westphalia | nordrhein westfalen | nrw | cologne | koln | dusseldorf | dortmund | essen | munster westfalen | aachen
Germany > Rhineland-Palatinate | rhineland palatinate | rheinland pfalz | mainz | trier | koblenz | birkenfeld
Germany > Saxony-Anhalt | saxony anhalt | sachsen anhalt | stolberg | stolberg harz | wernigerode | stolberg gedern | ilsenburg
Germany > Hohenzollern | hohenzollern | hohenzollern sigmaringen | hohenzollern hechingen | sigmaringen
Germany | osnabruck | hildesheim | luneburg | quedlinburg | emden | pforzheim | gottingen | wolfsburg | erbach | erbach schonberg | castell | remlingen | castell remlingen | solms | isenburg | ysenburg | leiningen | wied | sayn | bentheim | hohenlohe langenburg | langenburg | waldenburg | schwarzburg | stolberg wernigerode
Czechia > Bohemia | bohemia | bohmen | boehmen | cechy | kingdom of bohemia | konigreich bohmen | boheme | sudetenland | sudeten | prague | praha | prag | plzen | pilsen | ceske budejovice | budweis | karlsbad | karlovy vary
Czechia > Moravia | moravia | mahren | maehren | morava | margraviate of moravia | brno | brunn | olomouc | olmutz
Czechia > Czech Silesia | austrian silesia | osterreichisch schlesien | ceske slezsko | czech silesia | opava | troppau
Poland > Greater Poland | posen | poznan | province of posen | grand duchy of posen | greater poland | wielkopolska | wielkopolskie
Poland > Pomerelia | west prussia | westpreussen | danzig | free city of danzig | gdansk | pomerelia
Poland > Masovia | masovia | mazowsze | mazowieckie | warsaw | warszawa | warschau
Poland > Lesser Poland | lesser poland | malopolska | malopolskie | krakow | cracow | krakau
Poland > Silesia | upper silesia | oberschlesien | lower silesia | niederschlesien | breslau | wroclaw | slaskie
Poland | lodz | lublin | bialystok | posnania
Austria > Vienna | vienna | wien | vienne
Austria > Lower Austria | lower austria | niederosterreich
Austria > Upper Austria | upper austria | oberosterreich | linz
Austria > Styria | styria | steiermark | stajerska | graz
Austria > Carinthia | carinthia | karnten | kaernten | koroska
Austria > Salzburg | salzburg
Austria > Vorarlberg | vorarlberg
Austria > Burgenland | burgenland
Hungary | budapest | pest | buda | debrecen | szeged
Slovakia | upper hungary | felvidek | bratislava | pressburg | pozsony | kosice | kaschau
Slovenia | carniola | krain | kranjska | ljubljana | laibach | lower styria
Croatia | dalmatia | dalmacija | dalmatien | slavonia | slavonija | zagreb | agram | split | dubrovnik | ragusa
Serbia | belgrade | beograd | vojvodina
Romania > Transylvania | transylvania | siebenburgen | erdely | ardeal
Romania > Wallachia | wallachia | walachei | tara romaneasca
Romania | bucharest | bucuresti | iasi
Ukraine | subcarpathian ruthenia | carpathian ruthenia | ruthenia | volhynia | wolhynien | wolyn | podolia | podolien | kiev | kyiv | kiew | odessa | odesa | kharkiv | kharkov | lviv | lvov | lwow | lemberg | chernivtsi | czernowitz | zhytomyr | crimea
Latvia > Courland | courland | kurland | kurzeme
Latvia | riga | livland latvia
Estonia | estland | tallinn | reval | dorpat | tartu
Lithuania | vilnius | vilna | wilno | kaunas | kovno | memel | klaipeda
Belarus | minsk | grodno | hrodna | vitebsk | mogilev | pinsk
Russia | moscow | moskva | moskau | st petersburg | saint petersburg | sankt peterburg | petrograd | leningrad | siberia | sibirien | kaliningrad | konigsberg | koenigsberg | volga | samara | saratov
Finland | uusimaa | nyland | ostrobothnia | pohjanmaa | osterbotten | helsinki | helsingfors | turku | abo | viipuri | vyborg
Sweden | skane | scania | smaland | gotland | dalarna | dalecarlia | varmland | wermland | ostergotland | vastergotland | halland | blekinge | uppland | norrland | stockholm | goteborg | gothenburg | malmo | uppsala | stockholm sweden
Norway | more og romsdal | romsdal | sogn og fjordane | hordaland | rogaland | nordland | troms | finnmark | trondelag | sor trondelag | nord trondelag | oppland | hedmark | buskerud | telemark | vestfold | ostfold | akershus | agder | vest agder | aust agder | christiania | kristiania | oslo | bergen | trondheim | stavanger | alesund | orsta | volda
Denmark | jutland | jylland | zealand | sjaelland | funen | fyn | bornholm | copenhagen | kobenhavn | kjobenhavn | kopenhagen | odense | aarhus | aalborg | sonderborg | augustenborg | augustenburg
Netherlands | friesland | frisia | zeeland | north holland | noord holland | south holland | zuid holland | gelderland | groningen | drenthe | overijssel | utrecht | amsterdam | rotterdam | den haag | the hague | s gravenhage | leiden | haarlem | culemborg | dordrecht
Belgium | flanders | vlaanderen | flandre | wallonia | wallonie | brussels | bruxelles | brussel | antwerp | antwerpen | anvers | ghent | gent | liege | luik | bruges | brugge
France > Alsace | alsace | elsass | alsace lorraine | elsass lothringen | reichsland elsass lothringen | strasbourg | strassburg | colmar | mulhouse
France > Lorraine | lorraine | lothringen | metz | nancy
France | brittany | bretagne | normandy | normandie | provence | burgundy | bourgogne | gascony | gascogne | savoy | savoie | savoia | corsica | corse | picardy | picardie | champagne | languedoc | auvergne | aquitaine | poitou | anjou | touraine | paris | lyon | marseille | bordeaux | toulouse | lille | nantes | versailles | montbeliard | mompelgard
Switzerland | zurich | geneva | geneve | genf | bern | berne | basel | bale | lucerne | luzern | lausanne | vaud | graubunden | grisons | ticino | tessin | aargau | st gallen | appenzell | glarus | schaffhausen | thurgau | neuchatel | valais | wallis | fribourg | freiburg im uechtland
Italy > Sicily | sicily | sicilia | sizilien | palermo
Italy > Sardinia | sardinia | sardegna | kingdom of sardinia
Italy > Naples | kingdom of the two sicilies | two sicilies | kingdom of naples | naples | napoli | campania | calabria | apulia | puglia | abruzzo | abruzzi | basilicata | molise
Italy | papal states | stato pontificio | lombardy | lombardia | lombardei | piedmont | piemonte | venetia | veneto | venetien | tuscany | toscana | grand duchy of tuscany | liguria | emilia romagna | emilia | romagna | friuli | trentino | south tyrol | sudtirol | alto adige | marche | umbria | lazio | rome | roma | milan | milano | venice | venezia | florence | firenze | genoa | genova | turin | torino | bologna | modena | parma | lucca | mantua | mantova
Spain | catalonia | catalunya | cataluna | andalusia | andalucia | castile | castilla | basque country | pais vasco | euskadi | navarre | navarra | aragon | asturias | galicia spain | galicia espana | madrid | barcelona | seville | sevilla | bilbao | canary islands | islas canarias | balearic islands | mallorca | majorca
Portugal > Azores | azores | acores | ilhas dos acores | sao miguel | terceira | faial | sao jorge | graciosa | ponta delgada | ribeira grande | angra do heroismo | horta
Portugal > Madeira | madeira | funchal
Portugal | minho | tras os montes | algarve | beira | alentejo | estremadura | lisbon | lisboa | porto | oporto | coimbra | braga | aveiro | viseu
Greece | crete | kriti | κρήτη | heraklion | iraklion | peloponnese | peloponnesus | peloponnisos | morea | arcadia | arkadia | thessaly | thessalia | attica | attiki | laconia | lakonia | messenia | ionian islands | dodecanese | rhodes | rodos | athens | athina | athen | αθήνα | thessaloniki | salonika | salonica | piraeus | patras | sparta
Turkey | constantinople | istanbul | konstantinopel | smyrna | izmir | asia minor | anatolia | ankara | angora
Egypt | cairo | le caire
Israel | haifa | jaffa
South Africa | cape town | johannesburg | durban | pretoria
Mexico | mexico city | ciudad de mexico | guadalajara | veracruz
Argentina | buenos aires | rosario
Brazil | rio de janeiro | sao paulo | bahia
Cuba | havana | la habana
New Zealand | auckland | wellington | christchurch | dunedin | otago | canterbury nz
`;

const AMBIGUOUS = `
? Austria-Hungary > Austria, Hungary, Czechia, Slovakia, Poland, Ukraine, Croatia, Slovenia, Romania, Italy, Bosnia and Herzegovina, Serbia | austria hungary | austro hungarian empire | austro hungary | osterreich ungarn | oesterreich ungarn | k u k | austria hungria | autriche hongrie | rakousko uhersko | dual monarchy | austro hungarian monarchy | osztrak magyar monarchia
? Austrian Empire > Austria, Czechia, Hungary, Slovakia, Poland, Ukraine, Croatia, Slovenia, Italy, Romania | austrian empire | kaisertum osterreich | habsburg monarchy | habsburg empire | empire of austria | austria empire
? Russian Empire > Russia, Poland, Ukraine, Lithuania, Latvia, Estonia, Belarus, Finland, Moldova | russian empire | russisches reich | imperial russia | tsarist russia | empire of russia | российская империя | russia empire | czarist russia | russian poland empire
? Soviet Union > Russia, Ukraine, Belarus, Lithuania, Latvia, Estonia, Moldova, Georgia, Armenia, Azerbaijan, Kazakhstan | soviet union | ussr | cccp | ссср | sowjetunion | union sovietique | urss | union of soviet socialist republics
? Galicia > Poland, Ukraine, Spain | galicia | galizien | galicja | halychyna | kingdom of galicia and lodomeria | galicie
? Czechoslovakia > Czechia, Slovakia | czechoslovakia | ceskoslovensko | tschechoslowakei | czecho slovakia | tchecoslovaquie
? Yugoslavia > Serbia, Croatia, Slovenia, Bosnia and Herzegovina, Montenegro, North Macedonia, Kosovo | yugoslavia | jugoslavija | kingdom of yugoslavia | jugoslawien | kingdom of serbs croats and slovenes | sfrj
? Holy Roman Empire > Germany, Austria, Czechia, Italy, Netherlands, Belgium, Switzerland, France, Poland | holy roman empire | heiliges romisches reich | hre | heiliges romisches reich deutscher nation
? German Confederation > Germany, Austria, Czechia | german confederation | deutscher bund
? Silesia > Poland, Czechia, Germany | silesia | schlesien | slask | slezsko | duchy of silesia | province of silesia
? Pomerania > Germany, Poland | pomerania | pommern | pomorze | swedish pomerania | province of pomerania
? East Prussia > Poland, Russia, Lithuania | east prussia | ostpreussen | prusy wschodnie
? Schleswig > Germany, Denmark | schleswig | slesvig | duchy of schleswig | sonderjylland
? Tyrol > Austria, Italy | tyrol | tirol | county of tyrol
? Bessarabia > Moldova, Ukraine | bessarabia | bessarabien | basarabia
? Bukovina > Romania, Ukraine | bukovina | bukowina | bucovina
? Banat > Romania, Serbia, Hungary | banat
? Livonia > Latvia, Estonia | livonia | livland | liivimaa | vidzeme
? Moldavia > Romania, Moldova | moldavia | moldau | principality of moldavia
? Karelia > Finland, Russia | karelia | karjala | karelen
? Lapland > Finland, Sweden, Norway, Russia | lapland | lappland | lappi | sapmi
? Istria > Croatia, Slovenia, Italy | istria | istra | istrien
? Macedonia > North Macedonia, Greece, Bulgaria | macedonia | makedonia | mazedonien | macedoine
? Thrace > Greece, Turkey, Bulgaria | thrace | thraki | trakya
? Epirus > Greece, Albania | epirus | ipeiros
? Brabant > Netherlands, Belgium | brabant | duchy of brabant
? Limburg > Netherlands, Belgium | limburg | limbourg
? Palestine > Israel, Palestine | palestine | mandatory palestine | british mandate of palestine | palestina | jerusalem | holy land
? British India > India, Pakistan, Bangladesh, Myanmar | british india | indian empire | british raj | east india | east indies
? Bengal > India, Bangladesh | bengal | bengal presidency
? Punjab > India, Pakistan | punjab | panjab
? French Indochina > Vietnam, Laos, Cambodia | french indochina | indochine | indochina | indochine francaise | indochine francaise
? Rhodesia > Zimbabwe, Zambia | rhodesia
? Congo > Democratic Republic of the Congo, Republic of the Congo | congo
? Korea > South Korea, North Korea | korea | chosen | joseon | korean empire | korea japan
? Kurdistan > Turkey, Iraq, Iran, Syria | kurdistan
? New Spain > Mexico, United States, Spain | new spain | nueva espana
? West Indies > Jamaica, Barbados, Trinidad and Tobago, Bahamas, Cuba, Haiti | west indies | british west indies | caribbean | antilles
? Virgin Islands > United States, United Kingdom | virgin islands | us virgin islands | british virgin islands
? Straits Settlements > Malaysia, Singapore | straits settlements
? British Isles > United Kingdom, Ireland | british isles
? Scandinavia > Norway, Sweden, Denmark | scandinavia | skandinavien
? Transcaucasia > Georgia, Armenia, Azerbaijan | transcaucasia | transcaucasian sfsr
? Ottoman Greece > Greece, Turkey | ottoman greece
`;

// Regions with a Vietnamese flavour belong under Vietnam; kept separate because the names are
// also used as the region label in Atlas ("Tonkin").
const EXTRA_REGIONS = `
Vietnam > Tonkin | tonkin | bac ky | tonking
Vietnam > Annam | annam | trung ky
Vietnam > Cochinchina | cochinchina | cochin china | cochinchine | nam ky
Norway > More og Romsdal | more og romsdal
Georgia > Tbilisi | tbilisi | tiflis
`;

/** @type {Record<string, AliasEntry>} */
export const ALIASES = Object.create(null);
/** Canonical country names that appear in ALIASES. */
export const COUNTRY_NAMES = [];

function addEntry(alias, entry) {
  let code = false;
  let a = alias.trim();
  if (a.startsWith('^')) { code = true; a = a.slice(1); }
  const key = normalizePlaceKey(a);
  if (!key || ALIASES[key]) return; // first definition wins
  ALIASES[key] = code ? Object.freeze({ ...entry, code: true }) : entry;
}

function load(block) {
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.split('|').map(s => s.trim()).filter(Boolean);
    let label = cells.shift();
    let entry;
    if (label.startsWith('?')) {
      const [name, cands] = label.slice(1).split('>').map(s => s.trim());
      entry = Object.freeze({ country: null, region: name, ambiguous: true, candidates: Object.freeze(cands.split(',').map(s => s.trim())) });
      label = name;
    } else if (label.includes('>')) {
      const [country, region] = label.split('>').map(s => s.trim());
      entry = Object.freeze({ country, region, ambiguous: false });
      label = null;
      if (!COUNTRY_NAMES.includes(country)) COUNTRY_NAMES.push(country);
    } else {
      const bare = label.endsWith('!');
      if (bare) label = label.slice(0, -1).trim();
      entry = Object.freeze({ country: label, region: null, ambiguous: false });
      if (!COUNTRY_NAMES.includes(label)) COUNTRY_NAMES.push(label);
      if (bare) label = null;
    }
    if (label) addEntry(label, entry);
    for (const a of cells) addEntry(a, entry);
  }
}
load(EXTRA_REGIONS);
load(COUNTRIES);
load(REGIONS);
load(AMBIGUOUS);
// The country Georgia is loaded with "Georgia!" so the bare word stays the US state (the usual
// case in Ancestry-style files); "Republic of Georgia", "Sakartvelo" etc. reach the country.
Object.freeze(ALIASES);

// Prefixes and suffixes that wrap a name: "Kingdom of Bavaria", "County Cork", "Cook County".
const PREFIXES = ['kingdom of ', 'konigreich ', 'grand duchy of ', 'grossherzogtum ', 'duchy of ', 'herzogtum ', 'principality of ', 'furstentum ',
  'province of ', 'provinz ', 'republic of ', 'state of ', 'commonwealth of ', 'territory of ', 'colony of ', 'county of ', 'county ', 'co ',
  'city of ', 'stadt ', 'landkreis ', 'kreis ', 'district of ', 'departement ', 'department of ', 'parish of ', 'municipality of ', 'canton ', 'kanton ',
  'region ', 'regione ', 'oblast ', 'gubernia ', 'governorate of ', 'free state of ', 'electorate of ', 'margraviate of ', 'landgraviate of ', 'archduchy of '];
const SUFFIXES = [' county', ' co', ' parish', ' province', ' state', ' territory', ' colony', ' oblast', ' governorate', ' gubernia', ' guberniya',
  ' district', ' shire', ' kreis', ' region', ' island', ' islands', ' prefecture', ' voivodeship', ' department', ' canton', ' republic', ' ssr'];

function isCodeWritten(original) {
  const t = original.trim();
  if (/\./.test(t)) return true;
  const letters = t.replace(/[^A-Za-z]/g, '');
  return letters.length > 0 && letters === letters.toUpperCase();
}

/** Look up one comma part (with prefix/suffix stripping). */
function lookupPart(original) {
  const key = normalizePlaceKey(original);
  if (!key) return null;
  let e = ALIASES[key];
  if (e) return e.code && !isCodeWritten(original) ? null : e;
  for (const p of PREFIXES) {
    if (key.startsWith(p) && key.length > p.length + 1) {
      e = ALIASES[key.slice(p.length)];
      if (e && !e.code) return e;
    }
  }
  for (const s of SUFFIXES) {
    if (key.endsWith(s) && key.length > s.length + 1) {
      e = ALIASES[key.slice(0, -s.length)];
      if (e && !e.code) {
        // "Cork County" / "Mayo Co": fine. "Cook County": no entry, so nothing happens.
        return e;
      }
    }
  }
  return null;
}

/** Split a place string into comma parts, pulling "(now Poland)"-style notes to the end. */
function splitPlace(place) {
  const notes = [];
  const body = String(place).replace(/[([]([^)\]]*)[)\]]/g, (_, inner) => {
    const t = inner.replace(/^\s*(?:now|today|heute|nu|nyt|nå|actuel(?:lement)?|ora|hoy|dzis|nyni|nun|modern|present day|present-day)\s*:?\s*/i, '');
    if (t !== inner) notes.push(...t.split(','));
    else notes.push(...inner.split(','));
    return ' ';
  });
  const parts = body.split(/[,;]/).map(s => s.trim()).filter(s => s && !/^[?\-–_.]+$/.test(s));
  return { parts, notes: notes.map(s => s.trim()).filter(Boolean) };
}

const cache = new Map();

/**
 * Resolve the country of a free-text place.
 * The last meaningful comma part is tried first, then the others right to left.
 * Ambiguous historical states (Austria-Hungary, Russian Empire, Galicia...) come back with
 * country null and ambiguous true unless another part settles it.
 * @param {string|null|undefined} place
 * @returns {{ country: string|null, region: string|null, ambiguous: boolean, candidates?: string[] }}
 */
export function resolveCountry(place) {
  if (!place || typeof place !== 'string') return { country: null, region: null, ambiguous: false };
  const hit = cache.get(place);
  if (hit) return { ...hit };
  const res = resolveUncached(place);
  if (cache.size > 50000) cache.clear();
  cache.set(place, res);
  return { ...res };
}

function resolveUncached(place) {
  const { parts, notes } = splitPlace(place);
  // "(now Poland)" notes win: they state the modern country explicitly.
  const order = [...notes.slice().reverse(), ...parts.slice().reverse()];
  const all = [...parts, ...notes];
  let firstAmb = null;
  for (let i = 0; i < order.length; i++) {
    const e = lookupPart(order[i]);
    if (!e) continue;
    if (e.ambiguous) { if (!firstAmb) firstAmb = e; continue; }
    let region = e.region;
    if (!region) {
      // Country found; look further left for a region of the same country.
      for (let j = i + 1; j < order.length; j++) {
        const r = lookupPart(order[j]);
        if (r && !r.ambiguous && r.country === e.country && r.region) { region = r.region; break; }
      }
    }
    return { country: e.country, region, ambiguous: false };
  }
  if (!firstAmb && all.length > 1) {
    // Last resort: the whole string (a name that itself contains a comma).
    const e = lookupPart(parts.join(' '));
    if (e && !e.ambiguous) return { country: e.country, region: e.region, ambiguous: false };
  }
  if (firstAmb) return { country: null, region: firstAmb.region, ambiguous: true, candidates: [...firstAmb.candidates] };
  return { country: null, region: null, ambiguous: false };
}

/**
 * Normalise a PLAC value for display and as a stable key: trims parts, drops empty
 * jurisdictions (", , Cork, Ireland" -> "Cork, Ireland").
 * @param {string} place
 * @returns {string}
 */
const cleanCache = new Map();
export function cleanPlace(place) {
  if (!place) return '';
  const key = String(place);
  let v = cleanCache.get(key);
  if (v === undefined) {
    v = key.split(',').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).join(', ');
    if (cleanCache.size > 50000) cleanCache.clear();
    cleanCache.set(key, v);
  }
  return v;
}
