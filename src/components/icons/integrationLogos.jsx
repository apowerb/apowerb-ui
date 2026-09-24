"use client";

/**
 * Shared integration/provider logo icons, extracted from IntegrationsManager
 * (apowerb roadmap #103) so the same SVG marks can be reused anywhere a tool
 * needs to show its provider — the workflow studio tool picker and the
 * studio tool node, in addition to the Integrations page itself.
 *
 * Each icon is a plain SVG component (not a lucide icon): they render their
 * own brand colors and ignore `className`/`currentColor` styling, only
 * accepting a `size` prop, exactly as they did inline in IntegrationsManager.
 */

import { Database as DatabaseIcon, Wrench } from "lucide-react";

export function GithubIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M94,7399 C99.523,7399 104,7403.59 104,7409.253 C104,7413.782 101.138,7417.624 97.167,7418.981 C96.66,7419.082 96.48,7418.762 96.48,7418.489 C96.48,7418.151 96.492,7417.047 96.492,7415.675 C96.492,7414.719 96.172,7414.095 95.813,7413.777 C98.04,7413.523 100.38,7412.656 100.38,7408.718 C100.38,7407.598 99.992,7406.684 99.35,7405.966 C99.454,7405.707 99.797,7404.664 99.252,7403.252 C99.252,7403.252 98.414,7402.977 96.505,7404.303 C95.706,7404.076 94.85,7403.962 94,7403.958 C93.15,7403.962 92.295,7404.076 91.497,7404.303 C89.586,7402.977 88.746,7403.252 88.746,7403.252 C88.203,7404.664 88.546,7405.707 88.649,7405.966 C88.01,7406.684 87.619,7407.598 87.619,7408.718 C87.619,7412.646 89.954,7413.526 92.175,7413.785 C91.889,7414.041 91.63,7414.493 91.54,7415.156 C90.97,7415.418 89.522,7415.871 88.63,7414.304 C88.63,7414.304 88.101,7413.319 87.097,7413.247 C87.097,7413.247 86.122,7413.234 87.029,7413.87 C87.029,7413.87 87.684,7414.185 88.139,7415.37 C88.139,7415.37 88.726,7417.2 91.508,7416.58 C91.513,7417.437 91.522,7418.245 91.522,7418.489 C91.522,7418.76 91.338,7419.077 90.839,7418.982 C86.865,7417.627 84,7413.783 84,7409.253 C84,7403.59 88.478,7399 94,7399"
        fill="currentColor"
        transform="translate(-84, -7399)"
      />
    </svg>
  );
}

export function GoogleDriveIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA"/>
      <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L3.45 44.7c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47"/>
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L84.3 60.2c.8-1.4 1.2-2.95 1.2-4.5H58.05l6.85 12.5 8.65 8.6z" fill="#EA4335"/>
      <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2L43.65 25z" fill="#00832D"/>
      <path d="M58.05 49.2h-30.6l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h49.1c1.6 0 3.15-.45 4.5-1.2L58.05 49.2z" fill="#2684FC"/>
      <path d="M73.4 26.5L60.65 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.6 25l14.5 24.2h27.45c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00"/>
    </svg>
  );
}

export function GmailIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="52 42 88 66" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6"/>
      <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15"/>
      <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2"/>
      <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92"/>
      <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2"/>
    </svg>
  );
}

export function GoogleCalendarIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <path d="M152.637 200H47.363C21.207 200 0 178.793 0 152.637V47.363C0 21.207 21.207 0 47.363 0h105.274C178.793 0 200 21.207 200 47.363v105.274C200 178.793 178.793 200 152.637 200" fill="#fff"/>
      <path d="M152.637 200H47.363C21.207 200 0 178.793 0 152.637V47.363C0 21.207 21.207 0 47.363 0h105.274C178.793 0 200 21.207 200 47.363v105.274C200 178.793 178.793 200 152.637 200" fill="#4285F4" opacity=".4"/>
      <path d="M152.637 0H47.363C21.207 0 0 21.207 0 47.363V152.637C0 178.793 21.207 200 47.363 200h105.274C178.793 200 200 178.793 200 152.637V47.363C200 21.207 178.793 0 152.637 0M157.5 157.5h-115V42.5h115z" fill="#4285F4"/>
      <rect x="62.5" y="90" width="18" height="18" rx="2" fill="#EA4335"/>
      <rect x="91" y="90" width="18" height="18" rx="2" fill="#EA4335"/>
      <rect x="119.5" y="90" width="18" height="18" rx="2" fill="#EA4335"/>
      <rect x="62.5" y="118.5" width="18" height="18" rx="2" fill="#EA4335"/>
      <rect x="91" y="118.5" width="18" height="18" rx="2" fill="#EA4335"/>
      <rect x="119.5" y="118.5" width="18" height="18" rx="2" fill="#34A853"/>
      <path d="M152.637 0H47.363C21.207 0 0 21.207 0 47.363v10.305h200V47.363C200 21.207 178.793 0 152.637 0" fill="#1967D2"/>
    </svg>
  );
}

export function GoogleSheetsIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 88" xmlns="http://www.w3.org/2000/svg">
      <path d="M58 88H6a6 6 0 0 1-6-6V6a6 6 0 0 1 6-6h36l22 22v60a6 6 0 0 1-6 6z" fill="#23A566"/>
      <path d="M42 0l22 22H48a6 6 0 0 1-6-6V0z" fill="#1C8F5A"/>
      <rect x="12" y="36" width="40" height="36" rx="2" fill="#fff"/>
      <path d="M12 50h40M12 62h40M30 36v36" stroke="#23A566" strokeWidth="2" fill="none"/>
    </svg>
  );
}

export function GoogleDocsIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 88" xmlns="http://www.w3.org/2000/svg">
      <path d="M58 88H6a6 6 0 0 1-6-6V6a6 6 0 0 1 6-6h36l22 22v60a6 6 0 0 1-6 6z" fill="#4285F4"/>
      <path d="M42 0l22 22H48a6 6 0 0 1-6-6V0z" fill="#3367D6"/>
      <rect x="16" y="40" width="32" height="3" rx="1.5" fill="#fff"/>
      <rect x="16" y="48" width="32" height="3" rx="1.5" fill="#fff"/>
      <rect x="16" y="56" width="24" height="3" rx="1.5" fill="#fff"/>
      <rect x="16" y="64" width="28" height="3" rx="1.5" fill="#fff"/>
    </svg>
  );
}

export function OutlookIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1040.8409 742.6319" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink">
      <defs>
        <linearGradient id="ol-lg5"><stop style={{stopColor:"#1582d8"}} offset="0"/><stop style={{stopColor:"#0a64cc"}} offset="1"/></linearGradient>
        <linearGradient id="ol-lg6" xlinkHref="#ol-lg5" x1="749.08496" y1="212.54776" x2="738.25281" y2="843.01855" gradientUnits="userSpaceOnUse" gradientTransform="translate(-100)"/>
        <linearGradient id="ol-lg35"><stop style={{stopColor:"#4de2fb"}} offset="0"/><stop style={{stopColor:"#28aee8"}} offset="1"/></linearGradient>
        <linearGradient id="ol-lg36" xlinkHref="#ol-lg35" x1="1773.6024" y1="939.29254" x2="2272.7681" y2="729.0332" gradientUnits="userSpaceOnUse" gradientTransform="translate(982.3684)"/>
      </defs>
      <g transform="translate(-446.11368,-168.81981)">
        <g transform="matrix(0.7210846,0,0,0.7210846,-938.36876,150.65219)">
          <path style={{fill:"#158fda"}} d="m 2367.3337,1055.0767 h 732.6061 c 85.7128,0 155.1967,-69.48394 155.1967,-155.19671 V 374.94388 c 0,-45.60025 -22.8376,-87.46848 -62.4463,-110.06358 L 2809.398,46.917857 C 2758.4496,17.853896 2695.916,17.96081 2645.0673,47.198812 L 2210.7257,296.94524 v 601.52342 c 0,86.49223 70.1158,156.60804 156.608,156.60804 z"/>
          <path style={{fill:"url(#ol-lg36)"}} d="m 2512.5126,955.90485 c 4.0919,-47.14548 33.902,-88.17006 77.478,-106.6248 0,0 396.8646,-222.88902 593.633,-338.22376 60.9006,-35.69659 71.5129,-108.06656 71.5129,-108.06656 V 898.2074 c 0,86.63652 -70.2328,156.8693 -156.8693,156.8693 h -475.7159 c -56.6639,0 -104.1681,-42.8129 -110.0387,-99.17185 z"/>
          <g transform="translate(1651.4631)">
            <path style={{fill:"#26aee9"}} d="m 1079.793,26.322261 c -29.9013,-0.0714 -59.8212,7.48914 -86.73635,22.685551 L 416.91603,374.29883 635.43751,506.73242 1305.6445,128.9082 1166.4199,49.421871 c -26.8423,-15.32484 -56.7257,-23.02816 -86.6269,-23.09961 z"/>
            <path style={{fill:"#0078d3"}} d="M 1305.6445,128.9082 635.4375,506.73242 854.61328,639.5625 1537.8821,262.45117 c -5.424,-4.0613 -12.0375,-7.82732 -18.0051,-11.23437 z"/>
          </g>
          <g transform="rotate(-0.9287484,1474.7334,-101601.24)">
            <path style={{fill:"url(#ol-lg6)"}} d="m 380.53529,208.22328 537.09931,8.64896 a 52.98464,52.98464 0 0 1 52.1209,54.03844 l -10.4693,522.88117 a 54.6032,54.6032 0 0 1 -55.4714,53.50306 l -531.12401,-8.55273 a 55.65563,55.65563 0 0 1 -54.74837,-56.76254 l 10.48154,-523.49416 a 51.2957,51.2957 0 0 1 52.11133,-50.2622 z"/>
            <path fill="#ffffff" d="m 490.16342,435.72863 c 13.25707,-27.52059 34.65526,-50.55134 61.4478,-66.13255 29.67095,-16.55143 63.4538,-24.80264 97.62945,-23.84585 31.67488,-0.66941 62.93009,7.1541 90.35178,22.61579 25.78231,14.98096 46.54721,36.93136 59.77465,63.18764 14.40512,28.93194 21.58426,60.77252 20.95235,92.92329 0.69807,33.60039 -6.68849,66.89327 -21.56841,97.21171 -13.54236,27.19494 -34.96606,49.92756 -61.62353,65.38926 -6.0643,3.39337 -12.30713,6.42823 -18.69446,9.09614 -23.60846,9.861 -49.19125,14.70928 -75.03188,14.12058 -32.35158,0.76072 -64.29589,-7.15141 -92.34744,-22.87362 -26.00557,-15.00042 -47.03096,-36.97566 -60.56713,-63.30246 -14.49056,-28.51363 -21.75515,-59.99567 -21.18663,-91.80803 -0.60366,-33.31437 6.52861,-66.33062 20.86345,-96.5819 z m 65.49701,155.25283 c 7.06819,17.39811 19.05454,32.48715 34.56775,43.51674 15.80126,10.76035 34.72211,16.31173 53.99372,15.83973 20.52372,0.79094 40.75387,-4.94979 57.6329,-16.35472 15.31682,-10.99467 26.98825,-26.12467 33.56993,-43.51674 7.3576,-19.42313 10.98851,-39.99846 10.71081,-60.69999 0.2274,-20.89962 -3.18575,-41.68509 -10.09476,-61.47214 -6.10205,-17.86475 -17.39723,-33.61785 -32.51352,-45.3464 -16.4559,-11.94474 -36.63162,-18.00306 -57.13398,-17.15505 -19.68921,-0.49685 -39.03386,5.09818 -55.25548,15.98274 -15.77575,11.07592 -27.98953,26.29859 -35.21345,43.88804 -16.02521,40.31873 -16.10859,84.99973 -0.23498,125.37485 z"/>
          </g>
        </g>
      </g>
    </svg>
  );
}

export function TeamsIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tm-lg0" x1="19" y1="13.7368" x2="32.1591" y2="22.3355" gradientUnits="userSpaceOnUse">
          <stop stopColor="#364088"/><stop offset="1" stopColor="#6E7EE1"/>
        </linearGradient>
        <linearGradient id="tm-lg1" x1="9" y1="19.4038" x2="25" y2="19.4038" gradientUnits="userSpaceOnUse">
          <stop stopColor="#515FC4"/><stop offset="1" stopColor="#7084EA"/>
        </linearGradient>
        <linearGradient id="tm-lg2" x1="24" y1="5.31579" x2="29.7963" y2="9.39469" gradientUnits="userSpaceOnUse">
          <stop stopColor="#364088"/><stop offset="1" stopColor="#6E7EE1"/>
        </linearGradient>
        <linearGradient id="tm-lg3" x1="15.1429" y1="3.14286" x2="20.2857" y2="9.14286" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4858AE"/><stop offset="1" stopColor="#4E60CE"/>
        </linearGradient>
        <linearGradient id="tm-lg6" x1="0" y1="16" x2="18" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2A3887"/><stop offset="1" stopColor="#4C56B9"/>
        </linearGradient>
        <mask id="tm-mask0" style={{maskType:"alpha"}} maskUnits="userSpaceOnUse" x="9" y="0" width="16" height="30">
          <path d="M17 10C19.7615 10 22 7.76147 22 5C22 2.23853 19.7615 0 17 0C14.2385 0 12 2.23853 12 5C12 7.76147 14.2385 10 17 10Z" fill="url(#tm-lg3)"/>
          <path d="M10.2258 11C9.54883 11 9 11.5488 9 12.2258V22C9 26.4183 12.5817 30 17 30C21.4183 30 25 26.4183 25 22V12.2258C25 11.5488 24.4512 11 23.7742 11H10.2258Z" fill="url(#tm-lg3)"/>
        </mask>
      </defs>
      <path d="M19 13.9032C19 13.4044 19.4044 13 19.9032 13H31.0968C31.5956 13 32 13.4044 32 13.9032V20.5C32 24.0899 29.0899 27 25.5 27C21.9101 27 19 24.0899 19 20.5V13.9032Z" fill="url(#tm-lg0)"/>
      <path d="M9 12.2258C9 11.5488 9.54881 11 10.2258 11H23.7742C24.4512 11 25 11.5488 25 12.2258V22C25 26.4183 21.4183 30 17 30C12.5817 30 9 26.4183 9 22V12.2258Z" fill="url(#tm-lg1)"/>
      <circle cx="27" cy="8" r="3" fill="url(#tm-lg2)"/>
      <circle cx="18" cy="6" r="4" fill="url(#tm-lg3)"/>
      <g mask="url(#tm-mask0)">
        <path d="M7 12C7 10.3431 8.34315 9 10 9H17C18.6569 9 20 10.3431 20 12V24C20 25.6569 18.6569 27 17 27H7V12Z" fill="#000000" fillOpacity="0.3"/>
      </g>
      <rect y="7" width="18" height="18" rx="2" fill="url(#tm-lg6)"/>
      <path d="M13 11H5V12.8347H7.99494V21H10.0051V12.8347H13V11Z" fill="white"/>
    </svg>
  );
}

export function SharePointIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 450 500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sp-lg0" gradientUnits="userSpaceOnUse" x1="92.18" y1="477.480011" x2="292.290009" y2="214.839996" gradientTransform="matrix(1,0,0,-1,0,502)">
          <stop offset="0" style={{stopColor:"rgb(0%,89.019608%,87.45098%)"}}/>
          <stop offset="0.41" style={{stopColor:"rgb(0%,59.215686%,65.882353%)"}}/>
          <stop offset="1" style={{stopColor:"rgb(0%,46.666667%,56.862745%)"}}/>
        </linearGradient>
        <linearGradient id="sp-lg1" gradientUnits="userSpaceOnUse" x1="245.139999" y1="331.570007" x2="411.899994" y2="112.699997" gradientTransform="matrix(1,0,0,-1,0,502)">
          <stop offset="0" style={{stopColor:"rgb(0%,89.019608%,87.45098%)"}}/>
          <stop offset="0.48" style={{stopColor:"rgb(0%,63.529412%,72.156863%)"}}/>
          <stop offset="0.95" style={{stopColor:"rgb(0%,38.823529%,48.627451%)"}}/>
        </linearGradient>
        <linearGradient id="sp-lg2" gradientUnits="userSpaceOnUse" x1="153.419998" y1="214.529999" x2="259.709991" y2="1.97" gradientTransform="matrix(1,0,0,-1,0,502)">
          <stop offset="0.05" style={{stopColor:"rgb(45.882353%,100%,96.470588%)"}}/>
          <stop offset="0.51" style={{stopColor:"rgb(0%,78.039216%,81.960784%)"}}/>
          <stop offset="0.96" style={{stopColor:"rgb(0%,58.823529%,67.843137%)"}}/>
        </linearGradient>
        <linearGradient id="sp-lg3" gradientUnits="userSpaceOnUse" x1="292.440002" y1="-12.27" x2="235.630005" y2="67.449997" gradientTransform="matrix(1,0,0,-1,0,502)">
          <stop offset="0.26" style={{stopColor:"rgb(5.490196%,35.294118%,36.470588%)",stopOpacity:0.321569}}/>
          <stop offset="0.97" style={{stopColor:"rgb(10.980392%,58.039216%,54.117647%)",stopOpacity:0}}/>
        </linearGradient>
        <radialGradient id="sp-rg5" gradientUnits="userSpaceOnUse" cx="-686.599976" cy="804.179993" r="0.9" gradientTransform="matrix(222.887003,222.576004,222.926115,-222.537381,-26208.169922,332025.53125)">
          <stop offset="0.06" style={{stopColor:"rgb(0%,71.372549%,74.117647%)"}}/>
          <stop offset="0.89" style={{stopColor:"rgb(0%,28.627451%,36.078431%)"}}/>
        </radialGradient>
        <radialGradient id="sp-rg6" gradientUnits="userSpaceOnUse" cx="-686.070007" cy="864.409973" r="0.9" gradientTransform="matrix(0.000000000000009539,155.789993,177.619995,-0.000000000000010876,-153439.140625,107241.640625)">
          <stop offset="0.57" style={{stopColor:"rgb(11.764706%,52.156863%,50.588235%)",stopOpacity:0}}/>
          <stop offset="0.97" style={{stopColor:"rgb(11.764706%,79.607843%,90.196078%)",stopOpacity:0.6}}/>
        </radialGradient>
      </defs>
      <path style={{fill:"url(#sp-lg0)"}} d="M 187.789062 300 C 270.761719 300 338.019531 232.839844 338.019531 150 C 338.019531 67.160156 270.75 0 187.789062 0 C 104.828125 0 37.558594 67.160156 37.558594 150 C 37.558594 232.839844 104.820312 300 187.789062 300 Z"/>
      <path style={{fill:"url(#sp-lg1)"}} d="M 324.808594 400 C 393.949219 400 450 344.039062 450 275 C 450 205.960938 393.949219 150 324.808594 150 C 255.671875 150 199.621094 205.960938 199.621094 275 C 199.621094 344.039062 255.671875 400 324.808594 400 Z"/>
      <path style={{fill:"url(#sp-lg2)"}} d="M 206.558594 500 C 265.328125 500 312.96875 452.429688 312.96875 393.75 C 312.96875 335.070312 265.328125 287.5 206.558594 287.5 C 147.789062 287.5 100.148438 335.070312 100.148438 393.75 C 100.148438 452.429688 147.789062 500 206.558594 500 Z"/>
      <path style={{fill:"url(#sp-lg3)"}} d="M 206.558594 500 C 265.328125 500 312.96875 452.429688 312.96875 393.75 C 312.96875 335.070312 265.328125 287.5 206.558594 287.5 C 147.789062 287.5 100.148438 335.070312 100.148438 393.75 C 100.148438 452.429688 147.789062 500 206.558594 500 Z"/>
      <path style={{fill:"url(#sp-rg5)"}} d="M 40.660156 237.5 L 159.640625 237.5 C 182.097656 237.5 200.300781 255.703125 200.300781 278.160156 L 200.300781 396.839844 C 200.300781 419.296875 182.097656 437.5 159.640625 437.5 L 40.660156 437.5 C 18.203125 437.5 0 419.296875 0 396.839844 L 0 278.160156 C 0 255.703125 18.203125 237.5 40.660156 237.5 Z"/>
      <path style={{fill:"url(#sp-rg6)"}} d="M 40.660156 237.5 L 159.640625 237.5 C 182.097656 237.5 200.300781 255.703125 200.300781 278.160156 L 200.300781 396.839844 C 200.300781 419.296875 182.097656 437.5 159.640625 437.5 L 40.660156 437.5 C 18.203125 437.5 0 419.296875 0 396.839844 L 0 278.160156 C 0 255.703125 18.203125 237.5 40.660156 237.5 Z"/>
      <path style={{fill:"rgb(100%,100%,100%)"}} d="M 57 372.148438 L 78.71875 360.828125 C 81.171875 365.769531 84.359375 369.410156 88.300781 371.75 C 92.289062 374.089844 96.660156 375.261719 101.390625 375.261719 C 106.660156 375.261719 110.679688 374.199219 113.441406 372.070312 C 116.210938 369.890625 117.589844 366.621094 117.589844 362.269531 C 117.589844 358.871094 116.261719 356 113.601562 353.660156 C 110.941406 351.269531 106.230469 349.460938 99.46875 348.238281 C 86.589844 345.898438 77.21875 341.808594 71.371094 335.960938 C 65.570312 330.109375 62.671875 322.828125 62.671875 314.121094 C 62.671875 303.28125 66.5 294.621094 74.171875 288.128906 C 81.828125 281.648438 91.949219 278.410156 104.511719 278.410156 C 112.96875 278.410156 120.421875 280.140625 126.859375 283.589844 C 133.300781 287.039062 138.410156 291.988281 142.191406 298.421875 L 120.960938 309.339844 C 118.621094 305.730469 116.089844 303.121094 113.378906 301.53125 C 110.660156 299.878906 107.261719 299.058594 103.160156 299.058594 C 98.261719 299.058594 94.539062 300.121094 91.980469 302.25 C 89.480469 304.378906 88.230469 307.140625 88.230469 310.539062 C 88.230469 313.460938 89.429688 316.039062 91.820312 318.269531 C 94.269531 320.449219 99.160156 322.230469 106.511719 323.609375 C 118.859375 325.949219 128.070312 330.199219 134.128906 336.371094 C 140.25 342.480469 143.308594 350.210938 143.308594 359.570312 C 143.308594 370.941406 139.660156 379.949219 132.371094 386.589844 C 125.078125 393.230469 114.671875 396.550781 101.160156 396.550781 C 91.371094 396.550781 82.53125 394.421875 74.660156 390.171875 C 66.839844 385.871094 60.960938 379.859375 57.019531 372.148438 Z"/>
    </svg>
  );
}

export function OneDriveIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="35.98 139.2 648.03 430.85" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="od-rg0" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="matrix(130.864814,156.804864,-260.089994,217.063603,48.669602,228.766494)">
          <stop offset="0" style={{stopColor:"rgb(28.235294%,58.039216%,99.607843%)"}}/>
          <stop offset="0.695072" style={{stopColor:"rgb(3.529412%,20.392157%,70.196078%)"}}/>
        </radialGradient>
        <radialGradient id="od-rg1" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="matrix(-575.289668,663.594003,-491.728488,-426.294267,596.956501,-6.380235)">
          <stop offset="0.165327" style={{stopColor:"rgb(13.72549%,75.294118%,99.607843%)"}}/>
          <stop offset="0.534" style={{stopColor:"rgb(10.980392%,56.862745%,100%)"}}/>
        </radialGradient>
        <linearGradient id="od-lg0" gradientUnits="userSpaceOnUse" x1="29.999701" y1="37.9823" x2="29.999701" y2="18.398199" gradientTransform="matrix(15,0,0,15,0,0)">
          <stop offset="0" style={{stopColor:"rgb(0%,52.54902%,100%)"}}/>
          <stop offset="0.49" style={{stopColor:"rgb(0%,73.333333%,100%)"}}/>
        </linearGradient>
        <radialGradient id="od-rg5" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="matrix(-459.329491,459.329491,-719.614455,-719.614455,589.876499,39.484649)">
          <stop offset="0" style={{stopColor:"rgb(29.411765%,99.215686%,90.980392%)",stopOpacity:0.898039}}/>
          <stop offset="0.543937" style={{stopColor:"rgb(29.411765%,99.215686%,90.980392%)",stopOpacity:0}}/>
        </radialGradient>
        <radialGradient id="od-rg7" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="matrix(-305.683909,263.459223,-264.352324,-306.720147,674.845505,249.378004)">
          <stop offset="0" style={{stopColor:"rgb(29.411765%,99.215686%,90.980392%)",stopOpacity:0.898039}}/>
          <stop offset="0.584724" style={{stopColor:"rgb(29.411765%,99.215686%,90.980392%)",stopOpacity:0}}/>
        </radialGradient>
      </defs>
      <path style={{fill:"url(#od-rg0)"}} d="M 215.078125 205.089844 C 116.011719 205.09375 41.957031 286.1875 36.382812 376.527344 C 39.835938 395.992188 51.175781 434.429688 68.941406 432.457031 C 91.144531 429.988281 147.066406 432.457031 194.765625 346.105469 C 229.609375 283.027344 301.285156 205.085938 215.078125 205.089844 Z"/>
      <path style={{fill:"url(#od-rg1)"}} d="M 192.171875 238.8125 C 158.871094 291.535156 114.042969 367.085938 98.914062 390.859375 C 80.929688 419.121094 33.304688 407.113281 37.25 366.609375 C 36.863281 369.894531 36.5625 373.210938 36.355469 376.546875 C 29.84375 481.933594 113.398438 569.453125 217.375 569.453125 C 331.96875 569.453125 605.269531 426.671875 577.609375 283.609375 C 548.457031 199.519531 466.523438 139.203125 373.664062 139.203125 C 280.808594 139.203125 221.296875 192.699219 192.171875 238.8125 Z"/>
      <path style={{fill:"url(#od-rg5)"}} d="M 192.171875 238.8125 C 158.871094 291.535156 114.042969 367.085938 98.914062 390.859375 C 80.929688 419.121094 33.304688 407.113281 37.25 366.609375 C 36.863281 369.894531 36.5625 373.210938 36.355469 376.546875 C 29.84375 481.933594 113.398438 569.453125 217.375 569.453125 C 331.96875 569.453125 605.269531 426.671875 577.609375 283.609375 C 548.457031 199.519531 466.523438 139.203125 373.664062 139.203125 C 280.808594 139.203125 221.296875 192.699219 192.171875 238.8125 Z"/>
      <path style={{fill:"url(#od-lg0)"}} d="M 215.699219 569.496094 C 215.699219 569.496094 489.320312 570.035156 535.734375 570.035156 C 619.960938 570.035156 684 501.273438 684 421.03125 C 684 340.789062 618.671875 272.445312 535.734375 272.445312 C 452.792969 272.445312 405.027344 334.492188 369.152344 402.226562 C 327.117188 481.59375 273.488281 568.546875 215.699219 569.496094 Z"/>
      <path style={{fill:"url(#od-rg7)"}} d="M 215.699219 569.496094 C 215.699219 569.496094 489.320312 570.035156 535.734375 570.035156 C 619.960938 570.035156 684 501.273438 684 421.03125 C 684 340.789062 618.671875 272.445312 535.734375 272.445312 C 452.792969 272.445312 405.027344 334.492188 369.152344 402.226562 C 327.117188 481.59375 273.488281 568.546875 215.699219 569.496094 Z"/>
    </svg>
  );
}

/**
 * Fallback icon for a tool whose category matches no known integration —
 * the generic tool icon already used on the studio's tool node before this
 * change (apowerb roadmap #103).
 */
export const DEFAULT_TOOL_LOGO = Wrench;

/**
 * Icon used for database-flavoured tool categories (`database`,
 * `text_to_sql`, and anything that looks like a SQL/DB category string —
 * mirrors the substring matching already used for this purpose in
 * DatabaseConnectionSection.jsx / KnowledgeWizard.jsx).
 */
export const DATABASE_TOOL_LOGO = DatabaseIcon;

/**
 * Ordered category → logo rules. Order matters: some provider names are
 * substrings of one another (e.g. "onedrive" contains "drive"), so the more
 * specific match must run first.
 */
const CATEGORY_LOGO_RULES = [
  { test: (c) => c.includes("onedrive"), icon: OneDriveIcon },
  { test: (c) => c.includes("sharepoint"), icon: SharePointIcon },
  { test: (c) => c.includes("outlook"), icon: OutlookIcon },
  { test: (c) => c.includes("teams"), icon: TeamsIcon },
  { test: (c) => c.includes("gmail"), icon: GmailIcon },
  { test: (c) => c.includes("sheet"), icon: GoogleSheetsIcon },
  { test: (c) => c.includes("doc"), icon: GoogleDocsIcon },
  { test: (c) => c.includes("calendar"), icon: GoogleCalendarIcon },
  { test: (c) => c.includes("drive"), icon: GoogleDriveIcon },
  { test: (c) => c.includes("github"), icon: GithubIcon },
  { test: (c) => c.includes("database") || c.includes("text_to_sql") || c.includes("sql") || c.includes("db"), icon: DatabaseIcon },
];

/**
 * Resolve the logo to show for a tool category (as found on the objects
 * returned by `GET /tools`, e.g. `tools_google_gmail`, or on a tool config's
 * `tool_category`). Case-insensitive, tolerant of the `tools_` prefix used
 * by the tools API, falls back to the generic tool icon for anything
 * unrecognized (apowerb roadmap #103).
 */
export function getToolCategoryLogo(category) {
  const normalized = String(category || "")
    .toLowerCase()
    .replace(/^tools_/, "");
  if (!normalized) return DEFAULT_TOOL_LOGO;
  const rule = CATEGORY_LOGO_RULES.find((r) => r.test(normalized));
  return rule ? rule.icon : DEFAULT_TOOL_LOGO;
}
