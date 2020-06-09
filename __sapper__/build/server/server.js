'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var sirv = _interopDefault(require('sirv'));
var polka = _interopDefault(require('polka'));
var compression = _interopDefault(require('compression'));
var fs = _interopDefault(require('fs'));
var path = _interopDefault(require('path'));
var Stream = _interopDefault(require('stream'));
var http = _interopDefault(require('http'));
var Url = _interopDefault(require('url'));
var https = _interopDefault(require('https'));
var zlib = _interopDefault(require('zlib'));

function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function subscribe(store, ...callbacks) {
    if (store == null) {
        return noop;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
function get_store_value(store) {
    let value;
    subscribe(store, _ => value = _)();
    return value;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error(`Function called outside component initialization`);
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
function afterUpdate(fn) {
    get_current_component().$$.after_update.push(fn);
}
function setContext(key, context) {
    get_current_component().$$.context.set(key, context);
}
const escaped = {
    '"': '&quot;',
    "'": '&#39;',
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
};
function escape(html) {
    return String(html).replace(/["'&<>]/g, match => escaped[match]);
}
function each(items, fn) {
    let str = '';
    for (let i = 0; i < items.length; i += 1) {
        str += fn(items[i], i);
    }
    return str;
}
const missing_component = {
    $$render: () => ''
};
function validate_component(component, name) {
    if (!component || !component.$$render) {
        if (name === 'svelte:component')
            name += ' this={...}';
        throw new Error(`<${name}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules`);
    }
    return component;
}
let on_destroy;
function create_ssr_component(fn) {
    function $$render(result, props, bindings, slots) {
        const parent_component = current_component;
        const $$ = {
            on_destroy,
            context: new Map(parent_component ? parent_component.$$.context : []),
            // these will be immediately discarded
            on_mount: [],
            before_update: [],
            after_update: [],
            callbacks: blank_object()
        };
        set_current_component({ $$ });
        const html = fn(result, props, bindings, slots);
        set_current_component(parent_component);
        return html;
    }
    return {
        render: (props = {}, options = {}) => {
            on_destroy = [];
            const result = { title: '', head: '', css: new Set() };
            const html = $$render(result, props, {}, options);
            run_all(on_destroy);
            return {
                html,
                css: {
                    code: Array.from(result.css).map(css => css.code).join('\n'),
                    map: null // TODO
                },
                head: result.title + result.head
            };
        },
        $$render
    };
}
function add_attribute(name, value, boolean) {
    if (value == null || (boolean && !value))
        return '';
    return ` ${name}${value === true ? '' : `=${typeof value === 'string' ? JSON.stringify(escape(value)) : `"${value}"`}`}`;
}

const subscriber_queue = [];
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable(value, start = noop) {
    let stop;
    const subscribers = [];
    function set(new_value) {
        if (safe_not_equal(value, new_value)) {
            value = new_value;
            if (stop) { // store is ready
                const run_queue = !subscriber_queue.length;
                for (let i = 0; i < subscribers.length; i += 1) {
                    const s = subscribers[i];
                    s[1]();
                    subscriber_queue.push(s, value);
                }
                if (run_queue) {
                    for (let i = 0; i < subscriber_queue.length; i += 2) {
                        subscriber_queue[i][0](subscriber_queue[i + 1]);
                    }
                    subscriber_queue.length = 0;
                }
            }
        }
    }
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run, invalidate = noop) {
        const subscriber = [run, invalidate];
        subscribers.push(subscriber);
        if (subscribers.length === 1) {
            stop = start(set) || noop;
        }
        run(value);
        return () => {
            const index = subscribers.indexOf(subscriber);
            if (index !== -1) {
                subscribers.splice(index, 1);
            }
            if (subscribers.length === 0) {
                stop();
                stop = null;
            }
        };
    }
    return { set, update, subscribe };
}

const songs = [
  {
    id: 0,
    name: "光年之外 (LIGHT YEARS AWAY)",
    artist: "鄧紫琪 G.E.M.",
    cover: "https://stephenlaichaowen.github.io/my-assets/music-player/img/1.jpg",
    source: "https://stephenlaichaowen.github.io/my-assets/music-player/mp3/1.mp3",
    url: "https://www.youtube.com/watch?v=T4SimnaiktU&list=PLA9x9-eADvOoGjq1ce-FU0gpdMuq-Rk1l",
    favorited: false
  },
  {
    id: 1,
    name: "那些年，我們一起追的女孩",
    artist: "胡夏",
    cover: "https://stephenlaichaowen.github.io/my-assets/music-player/img/2.jpg",
    source: "https://stephenlaichaowen.github.io/my-assets/music-player/mp3/2.mp3",
    url: "https://www.youtube.com/watch?v=xWzlwGVQ6_Q&list=PLA9x9-eADvOoGjq1ce-FU0gpdMuq-Rk1l&index=4",
    favorited: true
  },
  {
    id: 2,
    name: "告白氣球 Love Confession",
    artist: "周杰倫 Jay Chou",
    cover: "https://stephenlaichaowen.github.io/my-assets/music-player/img/3.jpg",
    source: "https://stephenlaichaowen.github.io/my-assets/music-player/mp3/3.mp3",
    url: "https://www.youtube.com/watch?v=bu7nU9Mhpyo&list=PLA9x9-eADvOoGjq1ce-FU0gpdMuq-Rk1l&index=2",
    favorited: false
  },
  {
    id: 3,
    name: "是我不夠好 (Not Good Enough)",
    artist: "李毓芬 Tia Lee",
    cover: "https://stephenlaichaowen.github.io/my-assets/music-player/img/4.jpg",
    source: "https://stephenlaichaowen.github.io/my-assets/music-player/mp3/4.mp3",
    url: "https://www.youtube.com/watch?v=BsvIwqyiaJw&list=PLA9x9-eADvOoGjq1ce-FU0gpdMuq-Rk1l&index=78",
    favorited: false
  },
  {
    id: 4,
    name: "我的少女時代 (Our Times)",
    artist: "田馥甄 Hebe Tien",
    cover: "https://stephenlaichaowen.github.io/my-assets/music-player/img/5.jpg",
    source: "https://stephenlaichaowen.github.io/my-assets/music-player/mp3/5.mp3",
    url: "https://www.youtube.com/watch?v=_sQSXwdtxlY&list=PLA9x9-eADvOoGjq1ce-FU0gpdMuq-Rk1l&index=3",
    favorited: true
  },
  {
    id: 5,
    name: "手掌心 (Palm)",
    artist: "丁噹 Della",
    cover: "https://stephenlaichaowen.github.io/my-assets/music-player/img/6.jpg",
    source: "https://stephenlaichaowen.github.io/my-assets/music-player/mp3/6.mp3",
    url: "https://www.youtube.com/watch?v=7wvNwOPprBE&list=PLA9x9-eADvOoGjq1ce-FU0gpdMuq-Rk1l&index=21",
    favorited: false
  },
	{
    id: 6,
   	name: "我的歌聲裡 (You Exist In My Song)",
    artist: "曲婉婷 Wanting",
    cover: "https://stephenlaichaowen.github.io/my-assets/music-player/img/7.jpg",
    source: "https://stephenlaichaowen.github.io/my-assets/music-player/mp3/7.mp3",
    url: "https://www.youtube.com/watch?v=w0dMz8RBG7g&list=PLA9x9-eADvOoGjq1ce-FU0gpdMuq-Rk1l&index=9",
    favorited: false
  },
  {
    id: 7,
   	name: "變心的翅膀",
    artist: "陳明真",
    cover: "https://stephenlaichaowen.github.io/my-assets/music-player/img/8.jpg",
    source: "https://stephenlaichaowen.github.io/my-assets/music-player/mp3/8.mp3",
    url: "https://www.youtube.com/watch?v=L3wKzyIN1yk",
    favorited: true
  }
];

var route_1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    'default': songs
});

const songStore = writable(songs);

var route_0 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    'default': songStore
});

/* src\routes\index.svelte generated by Svelte v3.22.2 */

const css = {
	code: ".icon.svelte-y5hoaa.svelte-y5hoaa{display:inline-block;width:1em;height:1em;stroke-width:0;stroke:currentColor;fill:currentColor}.wrapper.svelte-y5hoaa.svelte-y5hoaa{width:100%;display:flex;align-items:center;justify-content:center;min-height:100vh;background-size:cover}@media screen and (max-width: 700px),\n  (max-height: 500px){.wrapper.svelte-y5hoaa.svelte-y5hoaa{flex-wrap:wrap;flex-direction:column}}.player.svelte-y5hoaa.svelte-y5hoaa{background:#eef3f7;max-width:410px;min-height:480px;box-shadow:0px 15px 35px -5px rgba(50, 88, 130, 0.32);border-radius:15px;padding:30px}@media screen and (max-width: 576px),\n  (max-height: 500px){.player.svelte-y5hoaa.svelte-y5hoaa{width:95%;padding:20px;margin-top:75px;min-height:initial;padding-bottom:30px;max-width:400px}}.player__top.svelte-y5hoaa.svelte-y5hoaa{display:flex;align-items:flex-start;position:relative;z-index:4}@media screen and (max-width: 576px),\n  (max-height: 500px){.player__top.svelte-y5hoaa.svelte-y5hoaa{flex-wrap:wrap}}.player-cover.svelte-y5hoaa.svelte-y5hoaa{width:300px;height:300px;margin-left:-70px;flex-shrink:0;position:relative;z-index:2;border-radius:15px;z-index:1}@media screen and (max-width: 576px),\n  (max-height: 500px){.player-cover.svelte-y5hoaa.svelte-y5hoaa{margin-top:-70px;margin-bottom:25px;max-width:250px;height:230px;margin-left:auto;margin-right:auto}}.player-cover__item.svelte-y5hoaa.svelte-y5hoaa{background-repeat:no-repeat;background-position:center;background-size:cover;width:100%;height:100%;border-radius:15px;position:absolute;left:0;top:0}.player-cover__item.svelte-y5hoaa.svelte-y5hoaa:before{content:\"\";background:inherit;width:100%;height:100%;box-shadow:0px 10px 40px 0px rgba(76, 70, 124, 0.5);display:block;z-index:1;position:absolute;top:30px;transform:scale(0.9);filter:blur(10px);opacity:0.9;border-radius:15px}.player-cover__item.svelte-y5hoaa.svelte-y5hoaa:after{content:\"\";background:inherit;width:100%;height:100%;box-shadow:0px 10px 40px 0px rgba(76, 70, 124, 0.5);display:block;z-index:2;position:absolute;border-radius:15px}.player-controls.svelte-y5hoaa.svelte-y5hoaa{flex:1;padding-left:20px;display:flex;flex-direction:column;align-items:center}@media screen and (max-width: 576px),\n  (max-height: 500px){.player-controls.svelte-y5hoaa.svelte-y5hoaa{flex-direction:row;padding-left:0;width:100%;flex:unset}}.player-controls__item.svelte-y5hoaa.svelte-y5hoaa{display:inline-flex;font-size:30px;padding:5px;margin-bottom:10px;color:#acb8cc;cursor:pointer;width:50px;height:50px;align-items:center;justify-content:center;position:relative;transition:all 0.3s ease-in-out}@media screen and (max-width: 576px),\n  (max-height: 500px){.player-controls__item.svelte-y5hoaa.svelte-y5hoaa{font-size:26px;padding:5px;margin-right:10px;color:#acb8cc;cursor:pointer;width:40px;height:40px;margin-bottom:0}}.player-controls__item.svelte-y5hoaa.svelte-y5hoaa::before{content:\"\";position:absolute;width:100%;height:100%;border-radius:50%;background:#fff;transform:scale(0.5);opacity:0;box-shadow:0px 5px 10px 0px rgba(76, 70, 124, 0.2);transition:all 0.3s ease-in-out;transition:all 0.4s cubic-bezier(0.35, 0.57, 0.13, 0.88)}@media screen and (min-width: 500px){.player-controls__item.svelte-y5hoaa.svelte-y5hoaa:hover{color:#532ab9}.player-controls__item.svelte-y5hoaa.svelte-y5hoaa:hover::before{opacity:1;transform:scale(1.3)}}@media screen and (max-width: 576px),\n  (max-height: 500px){.player-controls__item.svelte-y5hoaa.svelte-y5hoaa:active{color:#532ab9}.player-controls__item.svelte-y5hoaa.svelte-y5hoaa:active::before{opacity:1;transform:scale(1.3)}}.player-controls__item.svelte-y5hoaa .icon.svelte-y5hoaa{position:relative;z-index:2}.player-controls__item.-xl.svelte-y5hoaa.svelte-y5hoaa{margin-bottom:0;font-size:95px;filter:drop-shadow(0 11px 6px rgba(172, 184, 204, 0.45));color:#fff;width:auto;height:auto;display:inline-flex}@media screen and (max-width: 576px),\n  (max-height: 500px){.player-controls__item.-xl.svelte-y5hoaa.svelte-y5hoaa{margin-left:auto;font-size:75px;margin-right:0}}.player-controls__item.-xl.svelte-y5hoaa.svelte-y5hoaa:before{display:none}.player-controls__item.-favorite.active.svelte-y5hoaa.svelte-y5hoaa{color:red}[v-cloak].svelte-y5hoaa.svelte-y5hoaa{display:none}[v-cloak]>.svelte-y5hoaa.svelte-y5hoaa{display:none}.progress.svelte-y5hoaa.svelte-y5hoaa{width:100%;margin-top:-15px;user-select:none}.progress__top.svelte-y5hoaa.svelte-y5hoaa{display:flex;align-items:flex-end;justify-content:space-between}.progress__duration.svelte-y5hoaa.svelte-y5hoaa{color:#71829e;font-weight:700;font-size:20px;opacity:0.5}.progress__time.svelte-y5hoaa.svelte-y5hoaa{margin-top:2px;color:#71829e;font-weight:700;font-size:16px;opacity:0.7}.progress__bar.svelte-y5hoaa.svelte-y5hoaa{height:6px;width:100%;cursor:pointer;background-color:#d0d8e6;display:inline-block;border-radius:10px}.progress__current.svelte-y5hoaa.svelte-y5hoaa{height:inherit;width:0%;background-color:#a3b3ce;border-radius:10px}.album-info.svelte-y5hoaa.svelte-y5hoaa{color:#71829e;flex:1;padding-right:60px;user-select:none}@media screen and (max-width: 576px),\n  (max-height: 500px){.album-info.svelte-y5hoaa.svelte-y5hoaa{padding-right:30px}}.album-info__name.svelte-y5hoaa.svelte-y5hoaa{font-size:20px;font-weight:bold;margin-bottom:12px;line-height:1.3em}@media screen and (max-width: 576px),\n  (max-height: 500px){.album-info__name.svelte-y5hoaa.svelte-y5hoaa{font-size:18px;margin-bottom:9px}}.album-info__track.svelte-y5hoaa.svelte-y5hoaa{font-weight:400;font-size:20px;opacity:0.7;line-height:1.3em;min-height:52px}@media screen and (max-width: 576px),\n  (max-height: 500px){.album-info__track.svelte-y5hoaa.svelte-y5hoaa{font-size:18px;min-height:50px}}",
	map: "{\"version\":3,\"file\":\"index.svelte\",\"sources\":[\"index.svelte\"],\"sourcesContent\":[\"<svelte:head>\\n  <title>Mini Player</title>\\n</svelte:head>\\n\\n<script>\\n  import songStore from \\\"./store/songStore.js\\\";\\n  import { onMount } from 'svelte'\\n  import { scale } from 'svelte/transition'\\n\\n  let audio = null\\n  let circleLeft = null\\n  let barWidth = null\\n  let duration = 0\\n  let currentTime = null\\n  let isTimerPlaying = false\\n  let currentTrack = null\\n  let currentTrackIndex = 0\\n  let progress = 0\\n  let transitionName = null\\n  let isShowCover\\n  let songs = []\\n\\n  songStore.subscribe(value => { \\n    songs = value\\n    currentTrack = songs[0]\\n  })\\n\\n  onMount(() => {\\n    audio = new Audio();\\n    audio.src = currentTrack.source;\\n    audio.ontimeupdate = function() { generateTime() }\\n    audio.onloadedmetadata = function() { generateTime() }\\n    audio.onended = function() {\\n      nextTrack();\\n      isTimerPlaying = true;\\n    }\\n  })\\n\\n  function prevTrack() {\\n    transitionName = \\\"scale-in\\\"\\n    isShowCover = false\\n    if (currentTrackIndex > 0) {\\n      currentTrackIndex--\\n    } else {\\n      currentTrackIndex = songs.length - 1\\n    }\\n    currentTrack = songs[currentTrackIndex]\\n    resetPlayer()\\n  }\\n\\n  function resetPlayer() {\\n    barWidth = 0;\\n    circleLeft = 0;\\n    audio.currentTime = 0;\\n    audio.src = currentTrack.source;\\n    setTimeout(() => {\\n      if(isTimerPlaying) {\\n        audio.play();\\n      } else {\\n        audio.pause();\\n      }\\n    }, 300);\\n  }\\n\\n  function nextTrack() {\\n    transitionName = \\\"scale-out\\\";\\n    isShowCover = false;\\n    if (currentTrackIndex < songs.length - 1) {\\n      currentTrackIndex++;\\n    } else {\\n      currentTrackIndex = 0;\\n    }\\n    currentTrack = songs[currentTrackIndex];\\n    resetPlayer();\\n  }\\n\\n  function play() {\\n    if (audio.paused) {\\n      audio.play();\\n      isTimerPlaying = true;\\n    } else {\\n      audio.pause();\\n      isTimerPlaying = false;\\n    }\\n  }\\n\\n  function updateBar(x) {\\n    let maxduration = audio.duration;\\n    let position = x - progress.offsetLeft;\\n    let percentage = (100 * position) / progress.offsetWidth;\\n    \\n    if (percentage > 100) { percentage = 100 }\\n    if (percentage < 0) { percentage = 0 }\\n    \\n    barWidth = percentage + \\\"%\\\";\\n    circleLeft = percentage + \\\"%\\\";\\n    audio.currentTime = (maxduration * percentage) / 100;\\n    audio.play()\\n  }\\n\\n  function clickProgress(e) {\\n    isTimerPlaying = true;\\n    audio.pause();\\n    updateBar(e.pageX);\\n  }\\n\\n  function favorite() { \\n    currentTrack.favorited = !currentTrack.favorited\\n  }\\n\\n  function generateTime() {\\n    let width = (100 / audio.duration) * audio.currentTime;\\n\\n    barWidth = width + \\\"%\\\";\\n    circleLeft = width + \\\"%\\\";\\n    \\n    let durmin = Number(Math.floor(audio.duration / 60))\\n    let dursec = Number(Math.floor(audio.duration - durmin * 60))\\n    let curmin = Math.floor(audio.currentTime / 60);\\n    let cursec = Math.floor(audio.currentTime - curmin * 60);\\n\\n    if (durmin < 10) { durmin = \\\"0\\\" + durmin }\\n    if (dursec < 10) { dursec = \\\"0\\\" + dursec }\\n    if (curmin < 10) { curmin = \\\"0\\\" + curmin }\\n    if (cursec < 10) { cursec = \\\"0\\\" + cursec }\\n    \\n    duration = durmin + \\\":\\\" + dursec\\n    currentTime = curmin + \\\":\\\" + cursec\\n  }\\n</script>\\n\\n<div class=\\\"wrapper\\\">\\n  <div class=\\\"player\\\">\\n    <div class=\\\"player__top\\\">\\n      <div class=\\\"player-cover\\\">       \\n        {#each $songStore as { id, cover }, item}\\n          {#if id === currentTrackIndex}\\n            <div transition:scale=\\\"{{duration: 500}}\\\" class=\\\"player-cover__item\\\" style=\\\"background-image: url({cover})\\\" />          \\n          {/if}\\n        {/each}\\n      </div>\\n      <div class=\\\"player-controls\\\">\\n        <div class=\\\"player-controls__item -favorite\\\" class:active={currentTrack.favorited} on:click={favorite}>\\n          <svg class=\\\"icon\\\">\\n            <use xlink:href=\\\"#icon-heart-o\\\"></use>\\n          </svg>\\n        </div>\\n        <a\\n          href={currentTrack.url}\\n          target=\\\"_blank\\\"\\n          class=\\\"player-controls__item\\\">\\n          <svg class=\\\"icon\\\">\\n            <use xlink:href=\\\"#icon-link\\\" />\\n          </svg>\\n        </a>\\n        <div class=\\\"player-controls__item\\\" on:click={prevTrack}>\\n          <svg class=\\\"icon\\\">\\n            <use xlink:href=\\\"#icon-prev\\\" />\\n          </svg>\\n        </div>\\n        <div class=\\\"player-controls__item\\\" on:click={nextTrack}>\\n          <svg class=\\\"icon\\\">\\n            <use xlink:href=\\\"#icon-next\\\" />\\n          </svg>\\n        </div>\\n        <div class=\\\"player-controls__item -xl js-play\\\" on:click={play}>\\n          <svg class=\\\"icon\\\">\\n            {#if isTimerPlaying}\\n              <use xlink:href=\\\"#icon-pause\\\" />\\n            {:else}\\n              <use xlink:href=\\\"#icon-play\\\" />\\n            {/if}\\n          </svg>\\n        </div>\\n      </div>\\n    </div>\\n    <div class=\\\"progress\\\" bind:this={progress}>\\n      <div class=\\\"progress__top\\\">\\n          {#if currentTrack}\\n            <div class=\\\"album-info\\\">\\n                <div class=\\\"album-info__name\\\">{currentTrack.artist}</div>\\n                <div class=\\\"album-info__track\\\">{currentTrack.name}</div>\\n            </div>\\n          {/if}\\n        <div class=\\\"progress__duration\\\">{duration}</div>\\n      </div>\\n      <div class=\\\"progress__bar\\\" on:click={clickProgress}>\\n        <div class=\\\"progress__current\\\" style=\\\"width: {barWidth}\\\" />\\n      </div>\\n      <div class=\\\"progress__time\\\">{currentTime}</div>\\n    </div>\\n    <div v-cloak />\\n  </div>\\n</div>\\n\\n<svg\\n  xmlns=\\\"http://www.w3.org/2000/svg\\\"\\n  hidden\\n  xmlns:xlink=\\\"http://www.w3.org/1999/xlink\\\">\\n  <defs>\\n    <symbol id=\\\"icon-heart-o\\\" viewBox=\\\"0 0 32 32\\\">\\n      <title>icon-heart-o</title>\\n      <path\\n        d=\\\"M22.88 1.952c-2.72 0-5.184 1.28-6.88\\n        3.456-1.696-2.176-4.16-3.456-6.88-3.456-4.48 0-9.024 3.648-9.024 10.592\\n        0 7.232 7.776 12.704 15.072 17.248 0.256 0.16 0.544 0.256 0.832\\n        0.256s0.576-0.096 0.832-0.256c7.296-4.544 15.072-10.016 15.072-17.248\\n        0-6.944-4.544-10.592-9.024-10.592zM16\\n        26.56c-4.864-3.072-12.736-8.288-12.736-14.016 0-5.088 3.040-7.424\\n        5.824-7.424 2.368 0 4.384 1.504 5.408 4.032 0.256 0.608 0.832 0.992\\n        1.472 0.992s1.248-0.384 1.472-0.992c1.024-2.528 3.040-4.032 5.408-4.032\\n        2.816 0 5.824 2.304 5.824 7.424 0.064 5.728-7.808 10.976-12.672 14.016z\\\" />\\n      <path\\n        d=\\\"M16 30.144c-0.32\\n        0-0.64-0.096-0.896-0.256-7.296-4.576-15.104-10.048-15.104-17.344 0-7.008\\n        4.576-10.688 9.12-10.688 2.656 0 5.152 1.216 6.88 3.392 1.728-2.144\\n        4.224-3.392 6.88-3.392 4.544 0 9.12 3.68 9.12 10.688 0 7.296-7.808\\n        12.768-15.104 17.344-0.256 0.16-0.576 0.256-0.896 0.256zM9.12\\n        2.048c-4.448 0-8.928 3.616-8.928 10.496 0 7.168 7.744 12.64 15.008\\n        17.152 0.48 0.288 1.12 0.288 1.568 0 7.264-4.544 15.008-9.984\\n        15.008-17.152 0-6.88-4.48-10.496-8.928-10.496-2.656 0-5.088 1.216-6.816\\n        3.392l-0.032 0.128-0.064-0.096c-1.696-2.176-4.192-3.424-6.816-3.424zM16\\n        26.688l-0.064-0.032c-3.808-2.4-12.768-8.032-12.768-14.112 0-5.152\\n        3.072-7.52 5.952-7.52 2.432 0 4.48 1.536 5.504 4.096 0.224 0.576 0.768\\n        0.928 1.376 0.928s1.152-0.384 1.376-0.928c1.024-2.56 3.072-4.096\\n        5.504-4.096 2.848 0 5.952 2.336 5.952 7.52 0 6.080-8.96 11.712-12.768\\n        14.112l-0.064 0.032zM9.12 5.248c-2.752 0-5.728 2.304-5.728 7.328 0 5.952\\n        8.8 11.488 12.608 13.92 3.808-2.4 12.608-7.968 12.608-13.92\\n        0-5.024-2.976-7.328-5.728-7.328-2.336 0-4.32 1.472-5.312 3.968-0.256\\n        0.64-0.864 1.056-1.568\\n        1.056s-1.312-0.416-1.568-1.056c-0.992-2.496-2.976-3.968-5.312-3.968z\\\" />\\n      <path\\n        d=\\\"M6.816 20.704c0.384 0.288 0.512 0.704 0.48 1.12 0.224 0.256 0.384\\n        0.608 0.384 0.96 0 0.032 0 0.032 0 0.064 0.16 0.128 0.32 0.256 0.48\\n        0.384 0.128 0.064 0.256 0.16 0.384 0.256 0.096 0.064 0.192 0.16 0.256\\n        0.224 0.8 0.576 1.632 1.12 2.496 1.664 0.416 0.128 0.8 0.256 1.056 0.32\\n        1.984 0.576 4.064 0.8 6.112 0.928 2.688-1.92 5.312-3.904 8-5.792\\n        0.896-1.088 1.92-2.080\\n        2.912-3.104v-7.552c-0.096-0.128-0.192-0.288-0.32-0.416-0.768-1.024-1.184-2.176-1.6-3.296-0.768-0.416-1.536-0.8-2.336-1.12-0.128-0.064-0.256-0.096-0.384-0.16h-21.568v12.992c1.312\\n        0.672 2.496 1.6 3.648 2.528z\\\" />\\n    </symbol>\\n    <symbol id=\\\"icon-heart\\\" viewBox=\\\"0 0 32 32\\\">\\n      <title>icon-heart</title>\\n      <path\\n        d=\\\"M22.88 1.952c-2.72 0-5.184 1.28-6.88\\n        3.456-1.696-2.176-4.16-3.456-6.88-3.456-4.48 0-9.024 3.648-9.024 10.592\\n        0 7.232 7.776 12.704 15.072 17.248 0.256 0.16 0.544 0.256 0.832\\n        0.256s0.576-0.096 0.832-0.256c7.296-4.544 15.072-10.016 15.072-17.248\\n        0-6.944-4.544-10.592-9.024-10.592zM16\\n        26.56c-4.864-3.072-12.736-8.288-12.736-14.016 0-5.088 3.040-7.424\\n        5.824-7.424 2.368 0 4.384 1.504 5.408 4.032 0.256 0.608 0.832 0.992\\n        1.472 0.992s1.248-0.384 1.472-0.992c1.024-2.528 3.040-4.032 5.408-4.032\\n        2.816 0 5.824 2.304 5.824 7.424 0.064 5.728-7.808 10.976-12.672 14.016z\\\" />\\n      <path\\n        d=\\\"M16 30.144c-0.32\\n        0-0.64-0.096-0.896-0.256-7.296-4.576-15.104-10.048-15.104-17.344 0-7.008\\n        4.576-10.688 9.12-10.688 2.656 0 5.152 1.216 6.88 3.392 1.728-2.144\\n        4.224-3.392 6.88-3.392 4.544 0 9.12 3.68 9.12 10.688 0 7.296-7.808\\n        12.768-15.104 17.344-0.256 0.16-0.576 0.256-0.896 0.256zM9.12\\n        2.048c-4.448 0-8.928 3.616-8.928 10.496 0 7.168 7.744 12.64 15.008\\n        17.152 0.48 0.288 1.12 0.288 1.568 0 7.264-4.544 15.008-9.984\\n        15.008-17.152 0-6.88-4.48-10.496-8.928-10.496-2.656 0-5.088 1.216-6.816\\n        3.392l-0.032 0.128-0.064-0.096c-1.696-2.176-4.192-3.424-6.816-3.424zM16\\n        26.688l-0.064-0.032c-3.808-2.4-12.768-8.032-12.768-14.112 0-5.152\\n        3.072-7.52 5.952-7.52 2.432 0 4.48 1.536 5.504 4.096 0.224 0.576 0.768\\n        0.928 1.376 0.928s1.152-0.384 1.376-0.928c1.024-2.56 3.072-4.096\\n        5.504-4.096 2.848 0 5.952 2.336 5.952 7.52 0 6.080-8.96 11.712-12.768\\n        14.112l-0.064 0.032zM9.12 5.248c-2.752 0-5.728 2.304-5.728 7.328 0 5.952\\n        8.8 11.488 12.608 13.92 3.808-2.4 12.608-7.968 12.608-13.92\\n        0-5.024-2.976-7.328-5.728-7.328-2.336 0-4.32 1.472-5.312 3.968-0.256\\n        0.64-0.864 1.056-1.568\\n        1.056s-1.312-0.416-1.568-1.056c-0.992-2.496-2.976-3.968-5.312-3.968z\\\" />\\n    </symbol>\\n    <symbol id=\\\"icon-infinity\\\" viewBox=\\\"0 0 32 32\\\">\\n      <title>icon-infinity</title>\\n      <path\\n        d=\\\"M29.312 20.832c-1.28 1.28-3.008 1.984-4.832\\n        1.984s-3.52-0.704-4.832-1.984c-0.032-0.032-0.224-0.224-0.256-0.256v0\\n        1.28c0 0.448-0.352 0.8-0.8 0.8s-0.8-0.352-0.8-0.8v-3.168c0-0.448\\n        0.352-0.8 0.8-0.8h3.168c0.448 0 0.8 0.352 0.8 0.8s-0.352 0.8-0.8\\n        0.8h-1.28c0.032 0.032 0.224 0.224 0.256 0.256 0.992 0.992 2.304 1.536\\n        3.68 1.536 1.408 0 2.72-0.544 3.68-1.536 0.992-0.992 1.536-2.304\\n        1.536-3.68s-0.544-2.72-1.536-3.68c-0.992-0.992-2.304-1.536-3.68-1.536-1.408\\n        0-2.72 0.544-3.68 1.536l-8.416 8.448c-1.312 1.312-3.072 1.984-4.832\\n        1.984s-3.488-0.672-4.832-1.984c-2.656-2.656-2.656-6.976\\n        0-9.632s6.976-2.656 9.632 0c0.032 0.032 0.16 0.16 0.192 0.192l0.064\\n        0.064v-1.28c0-0.448 0.352-0.8 0.8-0.8s0.8 0.352 0.8 0.8v3.168c0\\n        0.448-0.352 0.8-0.8 0.8h-3.168c-0.448 0-0.8-0.352-0.8-0.8s0.352-0.8\\n        0.8-0.8h1.28l-0.096-0.064c-0.032-0.032-0.16-0.16-0.192-0.192-0.992-0.992-2.304-1.536-3.68-1.536s-2.72\\n        0.544-3.68 1.536c-2.048 2.048-2.048 5.344 0 7.392 0.992 0.992 2.304\\n        1.536 3.68 1.536s2.72-0.544 3.68-1.536l8.512-8.512c1.28-1.28 3.008-1.984\\n        4.832-1.984s3.52 0.704 4.832 1.984c2.624 2.656 2.624 7.008-0.032 9.664z\\\" />\\n      <path\\n        d=\\\"M24.512 23.488c-1.6 0-3.136-0.512-4.416-1.44-0.128 0.704-0.736\\n        1.248-1.44 1.248-0.8 0-1.472-0.672-1.472-1.472v-3.168c0-0.8 0.672-1.472\\n        1.472-1.472h3.168c0.8 0 1.472 0.672 1.472 1.472 0 0.608-0.384\\n        1.152-0.928 1.376 0.64 0.352 1.376 0.544 2.144 0.544 1.216 0 2.368-0.48\\n        3.2-1.344 0.864-0.864 1.344-1.984\\n        1.344-3.2s-0.48-2.368-1.344-3.2c-0.864-0.864-1.984-1.344-3.2-1.344s-2.368\\n        0.48-3.2 1.344l-8.512 8.48c-1.408 1.408-3.296 2.176-5.312\\n        2.176s-3.872-0.768-5.312-2.176c-2.912-2.912-2.912-7.68 0-10.592\\n        1.408-1.408 3.296-2.176 5.312-2.176 0 0 0 0 0 0 1.6 0 3.136 0.512 4.416\\n        1.44 0.128-0.704 0.736-1.248 1.472-1.248 0.8 0 1.472 0.672 1.472\\n        1.472v3.168c0 0.8-0.672 1.472-1.472 1.472h-3.168c-0.8\\n        0-1.472-0.672-1.472-1.472 0-0.608 0.384-1.152\\n        0.928-1.376-0.64-0.352-1.376-0.544-2.144-0.544-1.216 0-2.368 0.48-3.2\\n        1.344-1.76 1.76-1.76 4.64 0 6.432 0.864 0.864 2.016 1.344 3.2 1.344\\n        1.216 0 2.368-0.48 3.2-1.344l8.48-8.544c1.408-1.408 3.296-2.208\\n        5.312-2.208s3.872 0.768 5.312 2.208c1.408 1.408 2.176 3.296 2.176\\n        5.312s-0.768 3.872-2.208 5.312v0c0 0 0 0 0 0-1.408 1.408-3.296\\n        2.176-5.28 2.176zM18.752 18.912l1.44 1.44c1.152 1.152 2.688 1.792 4.32\\n        1.792s3.168-0.64 4.32-1.792v0c1.152-1.152 1.792-2.688\\n        1.792-4.32s-0.64-3.168-1.792-4.32c-1.152-1.152-2.688-1.792-4.352-1.792-1.632\\n        0-3.168 0.64-4.32 1.792l-8.48 8.448c-1.12 1.12-2.592 1.728-4.16\\n        1.728s-3.072-0.608-4.16-1.728c-2.304-2.304-2.304-6.048 0-8.352 1.12-1.12\\n        2.592-1.728 4.16-1.728s3.072 0.608 4.16 1.728l1.44 1.408h-2.912c-0.064\\n        0-0.128 0.064-0.128 0.128s0.064 0.128 0.128 0.128h3.168c0.064 0\\n        0.128-0.064 0.128-0.128v-3.168c0-0.064-0.064-0.128-0.128-0.128s-0.128\\n        0.064-0.128\\n        0.128v2.912l-1.408-1.408c-1.152-1.152-2.688-1.792-4.352-1.792-1.632\\n        0-3.168 0.64-4.32 1.792-2.4 2.4-2.4 6.272 0 8.672 1.152 1.152 2.688\\n        1.792 4.32 1.792s3.168-0.64 4.32-1.792l8.512-8.512c1.12-1.12 2.592-1.728\\n        4.16-1.728s3.072 0.608 4.16 1.728c1.12 1.12 1.728 2.592 1.728\\n        4.16s-0.608 3.072-1.728 4.16c-1.12 1.12-2.592 1.728-4.16\\n        1.728s-3.072-0.608-4.16-1.728l-1.408-1.408h2.912c0.064 0 0.128-0.064\\n        0.128-0.128s-0.064-0.128-0.128-0.128h-3.168c-0.064 0-0.128 0.064-0.128\\n        0.128v3.168c0 0.064 0.064 0.128 0.128 0.128s0.128-0.064\\n        0.128-0.128v-2.88z\\\" />\\n    </symbol>\\n    <symbol id=\\\"icon-pause\\\" viewBox=\\\"0 0 32 32\\\">\\n      <title>icon-pause</title>\\n      <path\\n        d=\\\"M16 0.32c-8.64 0-15.68 7.040-15.68 15.68s7.040 15.68 15.68 15.68\\n        15.68-7.040 15.68-15.68-7.040-15.68-15.68-15.68zM16 29.216c-7.296\\n        0-13.216-5.92-13.216-13.216s5.92-13.216 13.216-13.216 13.216 5.92 13.216\\n        13.216-5.92 13.216-13.216 13.216z\\\" />\\n      <path\\n        d=\\\"M16 32c-8.832 0-16-7.168-16-16s7.168-16 16-16 16 7.168 16 16-7.168\\n        16-16 16zM16 0.672c-8.448 0-15.328 6.88-15.328 15.328s6.88 15.328 15.328\\n        15.328c8.448 0 15.328-6.88 15.328-15.328s-6.88-15.328-15.328-15.328zM16\\n        29.568c-7.488 0-13.568-6.080-13.568-13.568s6.080-13.568\\n        13.568-13.568c7.488 0 13.568 6.080 13.568 13.568s-6.080 13.568-13.568\\n        13.568zM16 3.104c-7.104 0-12.896 5.792-12.896 12.896s5.792 12.896 12.896\\n        12.896c7.104 0 12.896-5.792 12.896-12.896s-5.792-12.896-12.896-12.896z\\\" />\\n      <path\\n        d=\\\"M12.16 22.336v0c-0.896 0-1.6-0.704-1.6-1.6v-9.472c0-0.896 0.704-1.6\\n        1.6-1.6v0c0.896 0 1.6 0.704 1.6 1.6v9.504c0 0.864-0.704 1.568-1.6 1.568z\\\" />\\n      <path\\n        d=\\\"M19.84 22.336v0c-0.896 0-1.6-0.704-1.6-1.6v-9.472c0-0.896 0.704-1.6\\n        1.6-1.6v0c0.896 0 1.6 0.704 1.6 1.6v9.504c0 0.864-0.704 1.568-1.6 1.568z\\\" />\\n    </symbol>\\n    <symbol id=\\\"icon-play\\\" viewBox=\\\"0 0 32 32\\\">\\n      <title>icon-play</title>\\n      <path\\n        d=\\\"M21.216 15.168l-7.616-5.088c-0.672-0.416-1.504 0.032-1.504\\n        0.832v10.176c0 0.8 0.896 1.248 1.504 0.832l7.616-5.088c0.576-0.416\\n        0.576-1.248 0-1.664z\\\" />\\n      <path\\n        d=\\\"M13.056 22.4c-0.224\\n        0-0.416-0.064-0.608-0.16-0.448-0.224-0.704-0.672-0.704-1.152v-10.176c0-0.48\\n        0.256-0.928 0.672-1.152s0.928-0.224 1.344 0.064l7.616 5.088c0.384 0.256\\n        0.608 0.672 0.608 1.088s-0.224 0.864-0.608 1.088l-7.616 5.088c-0.192\\n        0.16-0.448 0.224-0.704 0.224zM13.056 10.272c-0.096 0-0.224 0.032-0.32\\n        0.064-0.224 0.128-0.352 0.32-0.352 0.576v10.176c0 0.256 0.128 0.48 0.352\\n        0.576 0.224 0.128 0.448 0.096 0.64-0.032l7.616-5.088c0.192-0.128\\n        0.288-0.32\\n        0.288-0.544s-0.096-0.416-0.288-0.544l-7.584-5.088c-0.096-0.064-0.224-0.096-0.352-0.096z\\\" />\\n      <path\\n        d=\\\"M16 0.32c-8.64 0-15.68 7.040-15.68 15.68s7.040 15.68 15.68 15.68\\n        15.68-7.040 15.68-15.68-7.040-15.68-15.68-15.68zM16 29.216c-7.296\\n        0-13.216-5.92-13.216-13.216s5.92-13.216 13.216-13.216 13.216 5.92 13.216\\n        13.216-5.92 13.216-13.216 13.216z\\\" />\\n      <path\\n        d=\\\"M16 32c-8.832 0-16-7.168-16-16s7.168-16 16-16 16 7.168 16 16-7.168\\n        16-16 16zM16 0.672c-8.448 0-15.328 6.88-15.328 15.328s6.88 15.328 15.328\\n        15.328c8.448 0 15.328-6.88 15.328-15.328s-6.88-15.328-15.328-15.328zM16\\n        29.568c-7.488 0-13.568-6.080-13.568-13.568s6.080-13.568\\n        13.568-13.568c7.488 0 13.568 6.080 13.568 13.568s-6.080 13.568-13.568\\n        13.568zM16 3.104c-7.104 0-12.896 5.792-12.896 12.896s5.792 12.896 12.896\\n        12.896c7.104 0 12.896-5.792 12.896-12.896s-5.792-12.896-12.896-12.896z\\\" />\\n    </symbol>\\n    <symbol id=\\\"icon-link\\\" viewBox=\\\"0 0 32 32\\\">\\n      <title>link</title>\\n      <path\\n        d=\\\"M23.584 17.92c0 0.864 0 1.728 0 2.56 0 1.312 0 2.656 0 3.968 0 0.352\\n        0.032 0.736-0.032 1.12 0.032-0.16 0.032-0.288 0.064-0.448-0.032\\n        0.224-0.096 0.448-0.16 0.64 0.064-0.128 0.128-0.256 0.16-0.416-0.096\\n        0.192-0.192 0.384-0.32 0.576 0.096-0.128 0.16-0.224 0.256-0.352-0.128\\n        0.16-0.288 0.32-0.48 0.48 0.128-0.096 0.224-0.16 0.352-0.256-0.192\\n        0.128-0.352 0.256-0.576 0.32 0.128-0.064 0.256-0.128 0.416-0.16-0.224\\n        0.096-0.416 0.16-0.64 0.16 0.16-0.032 0.288-0.032 0.448-0.064-0.256\\n        0.032-0.512 0.032-0.768 0.032-0.448 0-0.896 0-1.312 0-1.472 0-2.976\\n        0-4.448 0-1.824 0-3.616 0-5.44 0-1.568 0-3.104 0-4.672 0-0.736 0-1.44\\n        0-2.176 0-0.128 0-0.224 0-0.352-0.032 0.16 0.032 0.288 0.032 0.448\\n        0.064-0.224-0.032-0.448-0.096-0.64-0.16 0.128 0.064 0.256 0.128 0.416\\n        0.16-0.192-0.096-0.384-0.192-0.576-0.32 0.128 0.096 0.224 0.16 0.352\\n        0.256-0.16-0.128-0.32-0.288-0.48-0.48 0.096 0.128 0.16 0.224 0.256\\n        0.352-0.128-0.192-0.256-0.352-0.32-0.576 0.064 0.128 0.128 0.256 0.16\\n        0.416-0.096-0.224-0.16-0.416-0.16-0.64 0.032 0.16 0.032 0.288 0.064\\n        0.448-0.032-0.256-0.032-0.512-0.032-0.768 0-0.448 0-0.896 0-1.312\\n        0-1.472 0-2.976 0-4.448 0-1.824 0-3.616 0-5.44 0-1.568 0-3.104 0-4.672\\n        0-0.736 0-1.44 0-2.176 0-0.128 0-0.224 0.032-0.352-0.032 0.16-0.032\\n        0.288-0.064 0.448 0.032-0.224 0.096-0.448 0.16-0.64-0.064 0.128-0.128\\n        0.256-0.16 0.416 0.096-0.192 0.192-0.384 0.32-0.576-0.096 0.128-0.16\\n        0.224-0.256 0.352 0.128-0.16 0.288-0.32 0.48-0.48-0.128 0.096-0.224\\n        0.16-0.352 0.256 0.192-0.128 0.352-0.256 0.576-0.32-0.128 0.064-0.256\\n        0.128-0.416 0.16 0.224-0.096 0.416-0.16 0.64-0.16-0.16 0.032-0.288\\n        0.032-0.448 0.064 0.48-0.064 0.96-0.032 1.44-0.032 0.992 0 1.952 0 2.944\\n        0 1.216 0 2.432 0 3.616 0 1.056 0 2.112 0 3.168 0 0.512 0 1.024 0 1.536\\n        0 0 0 0 0 0.032 0 0.448 0 0.896-0.192 1.184-0.48s0.512-0.768\\n        0.48-1.184c-0.032-0.448-0.16-0.896-0.48-1.184s-0.736-0.48-1.184-0.48c-0.64\\n        0-1.28 0-1.92 0-1.408 0-2.816 0-4.224 0-1.44 0-2.848 0-4.256 0-0.672\\n        0-1.344 0-2.016 0-0.736 0-1.472 0.192-2.112 0.576s-1.216 0.96-1.568\\n        1.6c-0.384 0.64-0.544 1.376-0.544 2.144 0 0.672 0 1.376 0 2.048 0 1.28 0\\n        2.56 0 3.84 0 1.504 0 3.040 0 4.544 0 1.408 0 2.848 0 4.256 0 0.992 0\\n        1.952 0 2.944 0 0.224 0 0.448 0 0.64 0 0.864 0.224 1.76 0.768 2.464 0.16\\n        0.192 0.288 0.384 0.48 0.576s0.384 0.352 0.608 0.512c0.32 0.224 0.64\\n        0.384 1.024 0.512 0.448 0.16 0.928 0.224 1.408 0.224 0.16 0 0.32 0 0.48\\n        0 0.896 0 1.792 0 2.72 0 1.376 0 2.784 0 4.16 0 1.536 0 3.040 0 4.576 0\\n        1.312 0 2.656 0 3.968 0 0.768 0 1.536 0 2.336 0 0.416 0 0.832-0.032\\n        1.248-0.128 1.504-0.32 2.784-1.6 3.104-3.104 0.128-0.544 0.128-1.056\\n        0.128-1.568 0-0.608 0-1.184 0-1.792 0-1.408 0-2.816 0-4.224 0-0.256\\n        0-0.512 0-0.768\\n        0-0.448-0.192-0.896-0.48-1.184s-0.768-0.512-1.184-0.48c-0.448\\n        0.032-0.896 0.16-1.184 0.48-0.384 0.384-0.576 0.768-0.576 1.248v0z\\\" />\\n      <path\\n        d=\\\"M32 11.232c0-0.8 0-1.568 0-2.368 0-1.248 0-2.528 0-3.776 0-0.288\\n        0-0.576 0-0.864 0-0.896-0.768-1.696-1.696-1.696-0.8 0-1.568 0-2.368\\n        0-1.248 0-2.528 0-3.776 0-0.288 0-0.576 0-0.864 0-0.448 0-0.896\\n        0.192-1.184 0.48s-0.512 0.768-0.48 1.184c0.032 0.448 0.16 0.896 0.48\\n        1.184s0.736 0.48 1.184 0.48c0.8 0 1.568 0 2.368 0 1.248 0 2.528 0 3.776\\n        0 0.288 0 0.576 0 0.864 0-0.576-0.576-1.12-1.12-1.696-1.696 0 0.8 0\\n        1.568 0 2.368 0 1.248 0 2.528 0 3.776 0 0.288 0 0.576 0 0.864 0 0.448\\n        0.192 0.896 0.48 1.184s0.768 0.512 1.184 0.48c0.448-0.032 0.896-0.16\\n        1.184-0.48 0.352-0.256 0.544-0.64 0.544-1.12v0z\\\" />\\n      <path\\n        d=\\\"M15.040 21.888c0.16-0.16 0.288-0.288 0.448-0.448 0.384-0.384 0.8-0.8\\n        1.184-1.184 0.608-0.608 1.184-1.184 1.792-1.792 0.704-0.704 1.44-1.44\\n        2.176-2.176 0.8-0.8 1.568-1.568 2.368-2.368s1.6-1.6 2.4-2.4c0.736-0.736\\n        1.504-1.504 2.24-2.24 0.64-0.64 1.248-1.248 1.888-1.888 0.448-0.448\\n        0.896-0.896 1.344-1.344 0.224-0.224 0.448-0.416 0.64-0.64 0 0\\n        0.032-0.032 0.032-0.032 0.32-0.32 0.48-0.768\\n        0.48-1.184s-0.192-0.896-0.48-1.184c-0.32-0.288-0.736-0.512-1.184-0.48-0.512\\n        0.032-0.928 0.16-1.248 0.48-0.16 0.16-0.288 0.288-0.448 0.448-0.384\\n        0.384-0.8 0.8-1.184 1.184-0.608 0.608-1.184 1.184-1.792 1.792-0.704\\n        0.704-1.44 1.44-2.176 2.176-0.8 0.8-1.568 1.568-2.368 2.368s-1.6 1.6-2.4\\n        2.4c-0.736 0.736-1.504 1.504-2.24 2.24-0.64 0.64-1.248 1.248-1.888\\n        1.888-0.448 0.448-0.896 0.896-1.344 1.344-0.224 0.224-0.448 0.416-0.64\\n        0.64 0 0-0.032 0.032-0.032 0.032-0.32 0.32-0.48 0.768-0.48 1.184s0.192\\n        0.896 0.48 1.184c0.32 0.288 0.736 0.512 1.184 0.48 0.48 0 0.928-0.16\\n        1.248-0.48v0z\\\" />\\n    </symbol>\\n    <symbol id=\\\"icon-next\\\" viewBox=\\\"0 0 32 32\\\">\\n      <title>next</title>\\n      <path\\n        d=\\\"M2.304 18.304h14.688l-4.608 4.576c-0.864 0.864-0.864 2.336 0 3.232\\n        0.864 0.864 2.336 0.864 3.232 0l8.448-8.48c0.864-0.864 0.864-2.336\\n        0-3.232l-8.448-8.448c-0.448-0.448-1.056-0.672-1.632-0.672s-1.184\\n        0.224-1.632 0.672c-0.864 0.864-0.864 2.336 0 3.232l4.64\\n        4.576h-14.688c-1.248 0-2.304 0.992-2.304 2.272s1.024 2.272 2.304 2.272z\\\" />\\n      <path\\n        d=\\\"M29.696 26.752c1.248 0 2.304-1.024\\n        2.304-2.304v-16.928c0-1.248-1.024-2.304-2.304-2.304s-2.304 1.024-2.304\\n        2.304v16.928c0.064 1.28 1.056 2.304 2.304 2.304z\\\" />\\n    </symbol>\\n    <symbol id=\\\"icon-prev\\\" viewBox=\\\"0 0 32 32\\\">\\n      <title>prev</title>\\n      <path\\n        d=\\\"M29.696 13.696h-14.688l4.576-4.576c0.864-0.864 0.864-2.336\\n        0-3.232-0.864-0.864-2.336-0.864-3.232 0l-8.448 8.48c-0.864 0.864-0.864\\n        2.336 0 3.232l8.448 8.448c0.448 0.448 1.056 0.672 1.632\\n        0.672s1.184-0.224 1.632-0.672c0.864-0.864 0.864-2.336\\n        0-3.232l-4.608-4.576h14.688c1.248 0 2.304-1.024\\n        2.304-2.304s-1.024-2.24-2.304-2.24z\\\" />\\n      <path\\n        d=\\\"M2.304 5.248c-1.248 0-2.304 1.024-2.304 2.304v16.928c0 1.248 1.024\\n        2.304 2.304 2.304s2.304-1.024\\n        2.304-2.304v-16.928c-0.064-1.28-1.056-2.304-2.304-2.304z\\\" />\\n    </symbol>\\n  </defs>\\n</svg>\\n\\n<style>\\n .icon {\\n    display: inline-block;\\n    width: 1em;\\n    height: 1em;\\n    stroke-width: 0;\\n    stroke: currentColor;\\n    fill: currentColor;\\n  }\\n\\n  .wrapper {\\n    width: 100%;\\n    display: flex;\\n    align-items: center;\\n    justify-content: center;\\n    min-height: 100vh;\\n    background-size: cover;\\n  }\\n\\n  @media screen and (max-width: 700px),\\n  (max-height: 500px) {\\n    .wrapper {\\n      flex-wrap: wrap;\\n      flex-direction: column;\\n    }\\n  }\\n\\n  .player {\\n    background: #eef3f7;\\n    max-width: 410px;\\n    min-height: 480px;\\n    box-shadow: 0px 15px 35px -5px rgba(50, 88, 130, 0.32);\\n    border-radius: 15px;\\n    padding: 30px;\\n  }\\n\\n  @media screen and (max-width: 576px),\\n  (max-height: 500px) {\\n    .player {\\n      width: 95%;\\n      padding: 20px;\\n      margin-top: 75px;\\n      min-height: initial;\\n      padding-bottom: 30px;\\n      max-width: 400px;\\n    }\\n  }\\n\\n  .player__top {\\n    display: flex;\\n    align-items: flex-start;\\n    position: relative;\\n    z-index: 4;\\n  }\\n\\n  @media screen and (max-width: 576px),\\n  (max-height: 500px) {\\n    .player__top {\\n      flex-wrap: wrap;\\n    }\\n  }\\n\\n  .player-cover {\\n    width: 300px;\\n    height: 300px;\\n    margin-left: -70px;\\n    flex-shrink: 0;\\n    position: relative;\\n    z-index: 2;\\n    border-radius: 15px;\\n    z-index: 1;\\n  }\\n\\n  @media screen and (max-width: 576px),\\n  (max-height: 500px) {\\n    .player-cover {\\n      margin-top: -70px;\\n      margin-bottom: 25px;\\n      max-width: 250px;\\n      height: 230px;\\n      margin-left: auto;\\n      margin-right: auto;\\n    }\\n  }\\n\\n  .player-cover__item {\\n    background-repeat: no-repeat;\\n    background-position: center;\\n    background-size: cover;\\n    width: 100%;\\n    height: 100%;\\n    border-radius: 15px;\\n    position: absolute;\\n    left: 0;\\n    top: 0;\\n  }\\n\\n  .player-cover__item:before {\\n    content: \\\"\\\";\\n    background: inherit;\\n    width: 100%;\\n    height: 100%;\\n    box-shadow: 0px 10px 40px 0px rgba(76, 70, 124, 0.5);\\n    display: block;\\n    z-index: 1;\\n    position: absolute;\\n    top: 30px;\\n    transform: scale(0.9);\\n    filter: blur(10px);\\n    opacity: 0.9;\\n    border-radius: 15px;\\n  }\\n\\n  .player-cover__item:after {\\n    content: \\\"\\\";\\n    background: inherit;\\n    width: 100%;\\n    height: 100%;\\n    box-shadow: 0px 10px 40px 0px rgba(76, 70, 124, 0.5);\\n    display: block;\\n    z-index: 2;\\n    position: absolute;\\n    border-radius: 15px;\\n  }\\n\\n  /* .player-cover__img {\\n    width: 100%;\\n    height: 100%;\\n    object-fit: cover;\\n    border-radius: 15px;\\n    box-shadow: 0px 10px 40px 0px rgba(76, 70, 124, 0.5);\\n    user-select: none;\\n    pointer-events: none;\\n  } */\\n\\n  .player-controls {\\n    flex: 1;\\n    padding-left: 20px;\\n    display: flex;\\n    flex-direction: column;\\n    align-items: center;\\n  }\\n\\n  @media screen and (max-width: 576px),\\n  (max-height: 500px) {\\n    .player-controls {\\n      flex-direction: row;\\n      padding-left: 0;\\n      width: 100%;\\n      flex: unset;\\n    }\\n  }\\n\\n  .player-controls__item {\\n    display: inline-flex;\\n    font-size: 30px;\\n    padding: 5px;\\n    margin-bottom: 10px;\\n    color: #acb8cc;\\n    cursor: pointer;\\n    width: 50px;\\n    height: 50px;\\n    align-items: center;\\n    justify-content: center;\\n    position: relative;\\n    transition: all 0.3s ease-in-out;\\n  }\\n\\n  @media screen and (max-width: 576px),\\n  (max-height: 500px) {\\n    .player-controls__item {\\n      font-size: 26px;\\n      padding: 5px;\\n      margin-right: 10px;\\n      color: #acb8cc;\\n      cursor: pointer;\\n      width: 40px;\\n      height: 40px;\\n      margin-bottom: 0;\\n    }\\n  }\\n\\n  .player-controls__item::before {\\n    content: \\\"\\\";\\n    position: absolute;\\n    width: 100%;\\n    height: 100%;\\n    border-radius: 50%;\\n    background: #fff;\\n    transform: scale(0.5);\\n    opacity: 0;\\n    box-shadow: 0px 5px 10px 0px rgba(76, 70, 124, 0.2);\\n    transition: all 0.3s ease-in-out;\\n    transition: all 0.4s cubic-bezier(0.35, 0.57, 0.13, 0.88);\\n  }\\n\\n  @media screen and (min-width: 500px) {\\n    .player-controls__item:hover {\\n      color: #532ab9;\\n    }\\n\\n    .player-controls__item:hover::before {\\n      opacity: 1;\\n      transform: scale(1.3);\\n    }\\n  }\\n\\n  @media screen and (max-width: 576px),\\n  (max-height: 500px) {\\n    .player-controls__item:active {\\n      color: #532ab9;\\n    }\\n\\n    .player-controls__item:active::before {\\n      opacity: 1;\\n      transform: scale(1.3);\\n    }\\n  }\\n\\n  .player-controls__item .icon {\\n    position: relative;\\n    z-index: 2;\\n  }\\n\\n  .player-controls__item.-xl {\\n    margin-bottom: 0;\\n    font-size: 95px;\\n    filter: drop-shadow(0 11px 6px rgba(172, 184, 204, 0.45));\\n    color: #fff;\\n    width: auto;\\n    height: auto;\\n    display: inline-flex;\\n  }\\n\\n  @media screen and (max-width: 576px),\\n  (max-height: 500px) {\\n    .player-controls__item.-xl {\\n      margin-left: auto;\\n      font-size: 75px;\\n      margin-right: 0;\\n    }\\n  }\\n\\n  .player-controls__item.-xl:before {\\n    display: none;\\n  }\\n\\n  .player-controls__item.-favorite.active {\\n    color: red;\\n  }\\n\\n  [v-cloak] {\\n    display: none;\\n  }\\n\\n  [v-cloak]>* {\\n    display: none;\\n  }\\n\\n  .progress {\\n    width: 100%;\\n    margin-top: -15px;\\n    user-select: none;\\n  }\\n\\n  .progress__top {\\n    display: flex;\\n    align-items: flex-end;\\n    justify-content: space-between;\\n  }\\n\\n  .progress__duration {\\n    color: #71829e;\\n    font-weight: 700;\\n    font-size: 20px;\\n    opacity: 0.5;\\n  }\\n\\n  .progress__time {\\n    margin-top: 2px;\\n    color: #71829e;\\n    font-weight: 700;\\n    font-size: 16px;\\n    opacity: 0.7;\\n  }\\n\\n  .progress__bar {\\n    height: 6px;\\n    width: 100%;\\n    cursor: pointer;\\n    background-color: #d0d8e6;\\n    display: inline-block;\\n    border-radius: 10px;\\n  }\\n\\n  .progress__current {\\n    height: inherit;\\n    width: 0%;\\n    background-color: #a3b3ce;\\n    border-radius: 10px;\\n  }\\n\\n  .album-info {\\n    color: #71829e;\\n    flex: 1;\\n    padding-right: 60px;\\n    user-select: none;\\n  }\\n\\n  @media screen and (max-width: 576px),\\n  (max-height: 500px) {\\n    .album-info {\\n      padding-right: 30px;\\n    }\\n  }\\n\\n  .album-info__name {\\n    font-size: 20px;\\n    font-weight: bold;\\n    margin-bottom: 12px;\\n    line-height: 1.3em;\\n  }\\n\\n  @media screen and (max-width: 576px),\\n  (max-height: 500px) {\\n    .album-info__name {\\n      font-size: 18px;\\n      margin-bottom: 9px;\\n    }\\n  }\\n\\n  .album-info__track {\\n    font-weight: 400;\\n    font-size: 20px;\\n    opacity: 0.7;\\n    line-height: 1.3em;\\n    min-height: 52px;\\n  }\\n\\n  @media screen and (max-width: 576px),\\n  (max-height: 500px) {\\n    .album-info__track {\\n      font-size: 18px;\\n      min-height: 50px;\\n    }\\n  }\\n\\n  /* .scale-out-enter-active {\\n    transition: all 0.35s ease-in-out;\\n  }\\n\\n  .scale-out-leave-active {\\n    transition: all 0.35s ease-in-out;\\n  }\\n\\n  .scale-out-enter {\\n    transform: scale(0.55);\\n    pointer-events: none;\\n    opacity: 0;\\n  }\\n\\n  .scale-out-leave-to {\\n    transform: scale(1.2);\\n    pointer-events: none;\\n    opacity: 0;\\n  }\\n\\n  .scale-in-enter-active {\\n    transition: all 0.35s ease-in-out;\\n  }\\n\\n  .scale-in-leave-active {\\n    transition: all 0.35s ease-in-out;\\n  }\\n\\n  .scale-in-enter {\\n    transform: scale(1.2);\\n    pointer-events: none;\\n    opacity: 0;\\n  }\\n\\n  .scale-in-leave-to {\\n    transform: scale(0.55);\\n    pointer-events: none;\\n    opacity: 0;\\n  } */\\n</style>\"],\"names\":[],\"mappings\":\"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\"}"
};

const Routes = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let $songStore = get_store_value(songStore);
	let audio = null;
	let barWidth = null;
	let duration = 0;
	let currentTime = null;
	let isTimerPlaying = false;
	let currentTrack = null;
	let currentTrackIndex = 0;
	let progress = 0;
	let songs = [];

	songStore.subscribe(value => {
		songs = value;
		currentTrack = songs[0];
	});

	onMount(() => {
		audio = new Audio();
		audio.src = currentTrack.source;

		audio.ontimeupdate = function () {
			generateTime();
		};

		audio.onloadedmetadata = function () {
			generateTime();
		};

		audio.onended = function () {
			nextTrack();
			isTimerPlaying = true;
		};
	});

	function resetPlayer() {
		barWidth = 0;
		audio.currentTime = 0;
		audio.src = currentTrack.source;

		setTimeout(
			() => {
				if (isTimerPlaying) {
					audio.play();
				} else {
					audio.pause();
				}
			},
			300
		);
	}

	function nextTrack() {

		if (currentTrackIndex < songs.length - 1) {
			currentTrackIndex++;
		} else {
			currentTrackIndex = 0;
		}

		currentTrack = songs[currentTrackIndex];
		resetPlayer();
	}

	function generateTime() {
		let width = 100 / audio.duration * audio.currentTime;
		barWidth = width + "%";
		let durmin = Number(Math.floor(audio.duration / 60));
		let dursec = Number(Math.floor(audio.duration - durmin * 60));
		let curmin = Math.floor(audio.currentTime / 60);
		let cursec = Math.floor(audio.currentTime - curmin * 60);

		if (durmin < 10) {
			durmin = "0" + durmin;
		}

		if (dursec < 10) {
			dursec = "0" + dursec;
		}

		if (curmin < 10) {
			curmin = "0" + curmin;
		}

		if (cursec < 10) {
			cursec = "0" + cursec;
		}

		duration = durmin + ":" + dursec;
		currentTime = curmin + ":" + cursec;
	}

	$$result.css.add(css);

	return `${($$result.head += `${($$result.title = `<title>Mini Player</title>`, "")}`, "")}



<div class="${"wrapper svelte-y5hoaa"}"><div class="${"player svelte-y5hoaa"}"><div class="${"player__top svelte-y5hoaa"}"><div class="${"player-cover svelte-y5hoaa"}">${each($songStore, ({ id, cover }, item) => `${id === currentTrackIndex
	? `<div class="${"player-cover__item svelte-y5hoaa"}" style="${"background-image: url(" + escape(cover) + ")"}"></div>`
	: ``}`)}</div>
      <div class="${"player-controls svelte-y5hoaa"}"><div class="${[
		"player-controls__item -favorite svelte-y5hoaa",
		currentTrack.favorited ? "active" : ""
	].join(" ").trim()}"><svg class="${"icon svelte-y5hoaa"}"><use xlink:href="${"#icon-heart-o"}"></use></svg></div>
        <a${add_attribute("href", currentTrack.url, 0)} target="${"_blank"}" class="${"player-controls__item svelte-y5hoaa"}"><svg class="${"icon svelte-y5hoaa"}"><use xlink:href="${"#icon-link"}"></use></svg></a>
        <div class="${"player-controls__item svelte-y5hoaa"}"><svg class="${"icon svelte-y5hoaa"}"><use xlink:href="${"#icon-prev"}"></use></svg></div>
        <div class="${"player-controls__item svelte-y5hoaa"}"><svg class="${"icon svelte-y5hoaa"}"><use xlink:href="${"#icon-next"}"></use></svg></div>
        <div class="${"player-controls__item -xl js-play svelte-y5hoaa"}"><svg class="${"icon svelte-y5hoaa"}">${isTimerPlaying
	? `<use xlink:href="${"#icon-pause"}"></use>`
	: `<use xlink:href="${"#icon-play"}"></use>`}</svg></div></div></div>
    <div class="${"progress svelte-y5hoaa"}"${add_attribute("this", progress, 1)}><div class="${"progress__top svelte-y5hoaa"}">${currentTrack
	? `<div class="${"album-info svelte-y5hoaa"}"><div class="${"album-info__name svelte-y5hoaa"}">${escape(currentTrack.artist)}</div>
                <div class="${"album-info__track svelte-y5hoaa"}">${escape(currentTrack.name)}</div></div>`
	: ``}
        <div class="${"progress__duration svelte-y5hoaa"}">${escape(duration)}</div></div>
      <div class="${"progress__bar svelte-y5hoaa"}"><div class="${"progress__current svelte-y5hoaa"}" style="${"width: " + escape(barWidth)}"></div></div>
      <div class="${"progress__time svelte-y5hoaa"}">${escape(currentTime)}</div></div>
    <div v-cloak class="${"svelte-y5hoaa"}"></div></div></div>

<svg xmlns="${"http://www.w3.org/2000/svg"}" hidden xmlns:xlink="${"http://www.w3.org/1999/xlink"}" class="${"svelte-y5hoaa"}"><defs><symbol id="${"icon-heart-o"}" viewBox="${"0 0 32 32"}"><title>icon-heart-o</title><path d="${"M22.88 1.952c-2.72 0-5.184 1.28-6.88\n        3.456-1.696-2.176-4.16-3.456-6.88-3.456-4.48 0-9.024 3.648-9.024 10.592\n        0 7.232 7.776 12.704 15.072 17.248 0.256 0.16 0.544 0.256 0.832\n        0.256s0.576-0.096 0.832-0.256c7.296-4.544 15.072-10.016 15.072-17.248\n        0-6.944-4.544-10.592-9.024-10.592zM16\n        26.56c-4.864-3.072-12.736-8.288-12.736-14.016 0-5.088 3.040-7.424\n        5.824-7.424 2.368 0 4.384 1.504 5.408 4.032 0.256 0.608 0.832 0.992\n        1.472 0.992s1.248-0.384 1.472-0.992c1.024-2.528 3.040-4.032 5.408-4.032\n        2.816 0 5.824 2.304 5.824 7.424 0.064 5.728-7.808 10.976-12.672 14.016z"}"></path><path d="${"M16 30.144c-0.32\n        0-0.64-0.096-0.896-0.256-7.296-4.576-15.104-10.048-15.104-17.344 0-7.008\n        4.576-10.688 9.12-10.688 2.656 0 5.152 1.216 6.88 3.392 1.728-2.144\n        4.224-3.392 6.88-3.392 4.544 0 9.12 3.68 9.12 10.688 0 7.296-7.808\n        12.768-15.104 17.344-0.256 0.16-0.576 0.256-0.896 0.256zM9.12\n        2.048c-4.448 0-8.928 3.616-8.928 10.496 0 7.168 7.744 12.64 15.008\n        17.152 0.48 0.288 1.12 0.288 1.568 0 7.264-4.544 15.008-9.984\n        15.008-17.152 0-6.88-4.48-10.496-8.928-10.496-2.656 0-5.088 1.216-6.816\n        3.392l-0.032 0.128-0.064-0.096c-1.696-2.176-4.192-3.424-6.816-3.424zM16\n        26.688l-0.064-0.032c-3.808-2.4-12.768-8.032-12.768-14.112 0-5.152\n        3.072-7.52 5.952-7.52 2.432 0 4.48 1.536 5.504 4.096 0.224 0.576 0.768\n        0.928 1.376 0.928s1.152-0.384 1.376-0.928c1.024-2.56 3.072-4.096\n        5.504-4.096 2.848 0 5.952 2.336 5.952 7.52 0 6.080-8.96 11.712-12.768\n        14.112l-0.064 0.032zM9.12 5.248c-2.752 0-5.728 2.304-5.728 7.328 0 5.952\n        8.8 11.488 12.608 13.92 3.808-2.4 12.608-7.968 12.608-13.92\n        0-5.024-2.976-7.328-5.728-7.328-2.336 0-4.32 1.472-5.312 3.968-0.256\n        0.64-0.864 1.056-1.568\n        1.056s-1.312-0.416-1.568-1.056c-0.992-2.496-2.976-3.968-5.312-3.968z"}"></path><path d="${"M6.816 20.704c0.384 0.288 0.512 0.704 0.48 1.12 0.224 0.256 0.384\n        0.608 0.384 0.96 0 0.032 0 0.032 0 0.064 0.16 0.128 0.32 0.256 0.48\n        0.384 0.128 0.064 0.256 0.16 0.384 0.256 0.096 0.064 0.192 0.16 0.256\n        0.224 0.8 0.576 1.632 1.12 2.496 1.664 0.416 0.128 0.8 0.256 1.056 0.32\n        1.984 0.576 4.064 0.8 6.112 0.928 2.688-1.92 5.312-3.904 8-5.792\n        0.896-1.088 1.92-2.080\n        2.912-3.104v-7.552c-0.096-0.128-0.192-0.288-0.32-0.416-0.768-1.024-1.184-2.176-1.6-3.296-0.768-0.416-1.536-0.8-2.336-1.12-0.128-0.064-0.256-0.096-0.384-0.16h-21.568v12.992c1.312\n        0.672 2.496 1.6 3.648 2.528z"}"></path></symbol><symbol id="${"icon-heart"}" viewBox="${"0 0 32 32"}"><title>icon-heart</title><path d="${"M22.88 1.952c-2.72 0-5.184 1.28-6.88\n        3.456-1.696-2.176-4.16-3.456-6.88-3.456-4.48 0-9.024 3.648-9.024 10.592\n        0 7.232 7.776 12.704 15.072 17.248 0.256 0.16 0.544 0.256 0.832\n        0.256s0.576-0.096 0.832-0.256c7.296-4.544 15.072-10.016 15.072-17.248\n        0-6.944-4.544-10.592-9.024-10.592zM16\n        26.56c-4.864-3.072-12.736-8.288-12.736-14.016 0-5.088 3.040-7.424\n        5.824-7.424 2.368 0 4.384 1.504 5.408 4.032 0.256 0.608 0.832 0.992\n        1.472 0.992s1.248-0.384 1.472-0.992c1.024-2.528 3.040-4.032 5.408-4.032\n        2.816 0 5.824 2.304 5.824 7.424 0.064 5.728-7.808 10.976-12.672 14.016z"}"></path><path d="${"M16 30.144c-0.32\n        0-0.64-0.096-0.896-0.256-7.296-4.576-15.104-10.048-15.104-17.344 0-7.008\n        4.576-10.688 9.12-10.688 2.656 0 5.152 1.216 6.88 3.392 1.728-2.144\n        4.224-3.392 6.88-3.392 4.544 0 9.12 3.68 9.12 10.688 0 7.296-7.808\n        12.768-15.104 17.344-0.256 0.16-0.576 0.256-0.896 0.256zM9.12\n        2.048c-4.448 0-8.928 3.616-8.928 10.496 0 7.168 7.744 12.64 15.008\n        17.152 0.48 0.288 1.12 0.288 1.568 0 7.264-4.544 15.008-9.984\n        15.008-17.152 0-6.88-4.48-10.496-8.928-10.496-2.656 0-5.088 1.216-6.816\n        3.392l-0.032 0.128-0.064-0.096c-1.696-2.176-4.192-3.424-6.816-3.424zM16\n        26.688l-0.064-0.032c-3.808-2.4-12.768-8.032-12.768-14.112 0-5.152\n        3.072-7.52 5.952-7.52 2.432 0 4.48 1.536 5.504 4.096 0.224 0.576 0.768\n        0.928 1.376 0.928s1.152-0.384 1.376-0.928c1.024-2.56 3.072-4.096\n        5.504-4.096 2.848 0 5.952 2.336 5.952 7.52 0 6.080-8.96 11.712-12.768\n        14.112l-0.064 0.032zM9.12 5.248c-2.752 0-5.728 2.304-5.728 7.328 0 5.952\n        8.8 11.488 12.608 13.92 3.808-2.4 12.608-7.968 12.608-13.92\n        0-5.024-2.976-7.328-5.728-7.328-2.336 0-4.32 1.472-5.312 3.968-0.256\n        0.64-0.864 1.056-1.568\n        1.056s-1.312-0.416-1.568-1.056c-0.992-2.496-2.976-3.968-5.312-3.968z"}"></path></symbol><symbol id="${"icon-infinity"}" viewBox="${"0 0 32 32"}"><title>icon-infinity</title><path d="${"M29.312 20.832c-1.28 1.28-3.008 1.984-4.832\n        1.984s-3.52-0.704-4.832-1.984c-0.032-0.032-0.224-0.224-0.256-0.256v0\n        1.28c0 0.448-0.352 0.8-0.8 0.8s-0.8-0.352-0.8-0.8v-3.168c0-0.448\n        0.352-0.8 0.8-0.8h3.168c0.448 0 0.8 0.352 0.8 0.8s-0.352 0.8-0.8\n        0.8h-1.28c0.032 0.032 0.224 0.224 0.256 0.256 0.992 0.992 2.304 1.536\n        3.68 1.536 1.408 0 2.72-0.544 3.68-1.536 0.992-0.992 1.536-2.304\n        1.536-3.68s-0.544-2.72-1.536-3.68c-0.992-0.992-2.304-1.536-3.68-1.536-1.408\n        0-2.72 0.544-3.68 1.536l-8.416 8.448c-1.312 1.312-3.072 1.984-4.832\n        1.984s-3.488-0.672-4.832-1.984c-2.656-2.656-2.656-6.976\n        0-9.632s6.976-2.656 9.632 0c0.032 0.032 0.16 0.16 0.192 0.192l0.064\n        0.064v-1.28c0-0.448 0.352-0.8 0.8-0.8s0.8 0.352 0.8 0.8v3.168c0\n        0.448-0.352 0.8-0.8 0.8h-3.168c-0.448 0-0.8-0.352-0.8-0.8s0.352-0.8\n        0.8-0.8h1.28l-0.096-0.064c-0.032-0.032-0.16-0.16-0.192-0.192-0.992-0.992-2.304-1.536-3.68-1.536s-2.72\n        0.544-3.68 1.536c-2.048 2.048-2.048 5.344 0 7.392 0.992 0.992 2.304\n        1.536 3.68 1.536s2.72-0.544 3.68-1.536l8.512-8.512c1.28-1.28 3.008-1.984\n        4.832-1.984s3.52 0.704 4.832 1.984c2.624 2.656 2.624 7.008-0.032 9.664z"}"></path><path d="${"M24.512 23.488c-1.6 0-3.136-0.512-4.416-1.44-0.128 0.704-0.736\n        1.248-1.44 1.248-0.8 0-1.472-0.672-1.472-1.472v-3.168c0-0.8 0.672-1.472\n        1.472-1.472h3.168c0.8 0 1.472 0.672 1.472 1.472 0 0.608-0.384\n        1.152-0.928 1.376 0.64 0.352 1.376 0.544 2.144 0.544 1.216 0 2.368-0.48\n        3.2-1.344 0.864-0.864 1.344-1.984\n        1.344-3.2s-0.48-2.368-1.344-3.2c-0.864-0.864-1.984-1.344-3.2-1.344s-2.368\n        0.48-3.2 1.344l-8.512 8.48c-1.408 1.408-3.296 2.176-5.312\n        2.176s-3.872-0.768-5.312-2.176c-2.912-2.912-2.912-7.68 0-10.592\n        1.408-1.408 3.296-2.176 5.312-2.176 0 0 0 0 0 0 1.6 0 3.136 0.512 4.416\n        1.44 0.128-0.704 0.736-1.248 1.472-1.248 0.8 0 1.472 0.672 1.472\n        1.472v3.168c0 0.8-0.672 1.472-1.472 1.472h-3.168c-0.8\n        0-1.472-0.672-1.472-1.472 0-0.608 0.384-1.152\n        0.928-1.376-0.64-0.352-1.376-0.544-2.144-0.544-1.216 0-2.368 0.48-3.2\n        1.344-1.76 1.76-1.76 4.64 0 6.432 0.864 0.864 2.016 1.344 3.2 1.344\n        1.216 0 2.368-0.48 3.2-1.344l8.48-8.544c1.408-1.408 3.296-2.208\n        5.312-2.208s3.872 0.768 5.312 2.208c1.408 1.408 2.176 3.296 2.176\n        5.312s-0.768 3.872-2.208 5.312v0c0 0 0 0 0 0-1.408 1.408-3.296\n        2.176-5.28 2.176zM18.752 18.912l1.44 1.44c1.152 1.152 2.688 1.792 4.32\n        1.792s3.168-0.64 4.32-1.792v0c1.152-1.152 1.792-2.688\n        1.792-4.32s-0.64-3.168-1.792-4.32c-1.152-1.152-2.688-1.792-4.352-1.792-1.632\n        0-3.168 0.64-4.32 1.792l-8.48 8.448c-1.12 1.12-2.592 1.728-4.16\n        1.728s-3.072-0.608-4.16-1.728c-2.304-2.304-2.304-6.048 0-8.352 1.12-1.12\n        2.592-1.728 4.16-1.728s3.072 0.608 4.16 1.728l1.44 1.408h-2.912c-0.064\n        0-0.128 0.064-0.128 0.128s0.064 0.128 0.128 0.128h3.168c0.064 0\n        0.128-0.064 0.128-0.128v-3.168c0-0.064-0.064-0.128-0.128-0.128s-0.128\n        0.064-0.128\n        0.128v2.912l-1.408-1.408c-1.152-1.152-2.688-1.792-4.352-1.792-1.632\n        0-3.168 0.64-4.32 1.792-2.4 2.4-2.4 6.272 0 8.672 1.152 1.152 2.688\n        1.792 4.32 1.792s3.168-0.64 4.32-1.792l8.512-8.512c1.12-1.12 2.592-1.728\n        4.16-1.728s3.072 0.608 4.16 1.728c1.12 1.12 1.728 2.592 1.728\n        4.16s-0.608 3.072-1.728 4.16c-1.12 1.12-2.592 1.728-4.16\n        1.728s-3.072-0.608-4.16-1.728l-1.408-1.408h2.912c0.064 0 0.128-0.064\n        0.128-0.128s-0.064-0.128-0.128-0.128h-3.168c-0.064 0-0.128 0.064-0.128\n        0.128v3.168c0 0.064 0.064 0.128 0.128 0.128s0.128-0.064\n        0.128-0.128v-2.88z"}"></path></symbol><symbol id="${"icon-pause"}" viewBox="${"0 0 32 32"}"><title>icon-pause</title><path d="${"M16 0.32c-8.64 0-15.68 7.040-15.68 15.68s7.040 15.68 15.68 15.68\n        15.68-7.040 15.68-15.68-7.040-15.68-15.68-15.68zM16 29.216c-7.296\n        0-13.216-5.92-13.216-13.216s5.92-13.216 13.216-13.216 13.216 5.92 13.216\n        13.216-5.92 13.216-13.216 13.216z"}"></path><path d="${"M16 32c-8.832 0-16-7.168-16-16s7.168-16 16-16 16 7.168 16 16-7.168\n        16-16 16zM16 0.672c-8.448 0-15.328 6.88-15.328 15.328s6.88 15.328 15.328\n        15.328c8.448 0 15.328-6.88 15.328-15.328s-6.88-15.328-15.328-15.328zM16\n        29.568c-7.488 0-13.568-6.080-13.568-13.568s6.080-13.568\n        13.568-13.568c7.488 0 13.568 6.080 13.568 13.568s-6.080 13.568-13.568\n        13.568zM16 3.104c-7.104 0-12.896 5.792-12.896 12.896s5.792 12.896 12.896\n        12.896c7.104 0 12.896-5.792 12.896-12.896s-5.792-12.896-12.896-12.896z"}"></path><path d="${"M12.16 22.336v0c-0.896 0-1.6-0.704-1.6-1.6v-9.472c0-0.896 0.704-1.6\n        1.6-1.6v0c0.896 0 1.6 0.704 1.6 1.6v9.504c0 0.864-0.704 1.568-1.6 1.568z"}"></path><path d="${"M19.84 22.336v0c-0.896 0-1.6-0.704-1.6-1.6v-9.472c0-0.896 0.704-1.6\n        1.6-1.6v0c0.896 0 1.6 0.704 1.6 1.6v9.504c0 0.864-0.704 1.568-1.6 1.568z"}"></path></symbol><symbol id="${"icon-play"}" viewBox="${"0 0 32 32"}"><title>icon-play</title><path d="${"M21.216 15.168l-7.616-5.088c-0.672-0.416-1.504 0.032-1.504\n        0.832v10.176c0 0.8 0.896 1.248 1.504 0.832l7.616-5.088c0.576-0.416\n        0.576-1.248 0-1.664z"}"></path><path d="${"M13.056 22.4c-0.224\n        0-0.416-0.064-0.608-0.16-0.448-0.224-0.704-0.672-0.704-1.152v-10.176c0-0.48\n        0.256-0.928 0.672-1.152s0.928-0.224 1.344 0.064l7.616 5.088c0.384 0.256\n        0.608 0.672 0.608 1.088s-0.224 0.864-0.608 1.088l-7.616 5.088c-0.192\n        0.16-0.448 0.224-0.704 0.224zM13.056 10.272c-0.096 0-0.224 0.032-0.32\n        0.064-0.224 0.128-0.352 0.32-0.352 0.576v10.176c0 0.256 0.128 0.48 0.352\n        0.576 0.224 0.128 0.448 0.096 0.64-0.032l7.616-5.088c0.192-0.128\n        0.288-0.32\n        0.288-0.544s-0.096-0.416-0.288-0.544l-7.584-5.088c-0.096-0.064-0.224-0.096-0.352-0.096z"}"></path><path d="${"M16 0.32c-8.64 0-15.68 7.040-15.68 15.68s7.040 15.68 15.68 15.68\n        15.68-7.040 15.68-15.68-7.040-15.68-15.68-15.68zM16 29.216c-7.296\n        0-13.216-5.92-13.216-13.216s5.92-13.216 13.216-13.216 13.216 5.92 13.216\n        13.216-5.92 13.216-13.216 13.216z"}"></path><path d="${"M16 32c-8.832 0-16-7.168-16-16s7.168-16 16-16 16 7.168 16 16-7.168\n        16-16 16zM16 0.672c-8.448 0-15.328 6.88-15.328 15.328s6.88 15.328 15.328\n        15.328c8.448 0 15.328-6.88 15.328-15.328s-6.88-15.328-15.328-15.328zM16\n        29.568c-7.488 0-13.568-6.080-13.568-13.568s6.080-13.568\n        13.568-13.568c7.488 0 13.568 6.080 13.568 13.568s-6.080 13.568-13.568\n        13.568zM16 3.104c-7.104 0-12.896 5.792-12.896 12.896s5.792 12.896 12.896\n        12.896c7.104 0 12.896-5.792 12.896-12.896s-5.792-12.896-12.896-12.896z"}"></path></symbol><symbol id="${"icon-link"}" viewBox="${"0 0 32 32"}"><title>link</title><path d="${"M23.584 17.92c0 0.864 0 1.728 0 2.56 0 1.312 0 2.656 0 3.968 0 0.352\n        0.032 0.736-0.032 1.12 0.032-0.16 0.032-0.288 0.064-0.448-0.032\n        0.224-0.096 0.448-0.16 0.64 0.064-0.128 0.128-0.256 0.16-0.416-0.096\n        0.192-0.192 0.384-0.32 0.576 0.096-0.128 0.16-0.224 0.256-0.352-0.128\n        0.16-0.288 0.32-0.48 0.48 0.128-0.096 0.224-0.16 0.352-0.256-0.192\n        0.128-0.352 0.256-0.576 0.32 0.128-0.064 0.256-0.128 0.416-0.16-0.224\n        0.096-0.416 0.16-0.64 0.16 0.16-0.032 0.288-0.032 0.448-0.064-0.256\n        0.032-0.512 0.032-0.768 0.032-0.448 0-0.896 0-1.312 0-1.472 0-2.976\n        0-4.448 0-1.824 0-3.616 0-5.44 0-1.568 0-3.104 0-4.672 0-0.736 0-1.44\n        0-2.176 0-0.128 0-0.224 0-0.352-0.032 0.16 0.032 0.288 0.032 0.448\n        0.064-0.224-0.032-0.448-0.096-0.64-0.16 0.128 0.064 0.256 0.128 0.416\n        0.16-0.192-0.096-0.384-0.192-0.576-0.32 0.128 0.096 0.224 0.16 0.352\n        0.256-0.16-0.128-0.32-0.288-0.48-0.48 0.096 0.128 0.16 0.224 0.256\n        0.352-0.128-0.192-0.256-0.352-0.32-0.576 0.064 0.128 0.128 0.256 0.16\n        0.416-0.096-0.224-0.16-0.416-0.16-0.64 0.032 0.16 0.032 0.288 0.064\n        0.448-0.032-0.256-0.032-0.512-0.032-0.768 0-0.448 0-0.896 0-1.312\n        0-1.472 0-2.976 0-4.448 0-1.824 0-3.616 0-5.44 0-1.568 0-3.104 0-4.672\n        0-0.736 0-1.44 0-2.176 0-0.128 0-0.224 0.032-0.352-0.032 0.16-0.032\n        0.288-0.064 0.448 0.032-0.224 0.096-0.448 0.16-0.64-0.064 0.128-0.128\n        0.256-0.16 0.416 0.096-0.192 0.192-0.384 0.32-0.576-0.096 0.128-0.16\n        0.224-0.256 0.352 0.128-0.16 0.288-0.32 0.48-0.48-0.128 0.096-0.224\n        0.16-0.352 0.256 0.192-0.128 0.352-0.256 0.576-0.32-0.128 0.064-0.256\n        0.128-0.416 0.16 0.224-0.096 0.416-0.16 0.64-0.16-0.16 0.032-0.288\n        0.032-0.448 0.064 0.48-0.064 0.96-0.032 1.44-0.032 0.992 0 1.952 0 2.944\n        0 1.216 0 2.432 0 3.616 0 1.056 0 2.112 0 3.168 0 0.512 0 1.024 0 1.536\n        0 0 0 0 0 0.032 0 0.448 0 0.896-0.192 1.184-0.48s0.512-0.768\n        0.48-1.184c-0.032-0.448-0.16-0.896-0.48-1.184s-0.736-0.48-1.184-0.48c-0.64\n        0-1.28 0-1.92 0-1.408 0-2.816 0-4.224 0-1.44 0-2.848 0-4.256 0-0.672\n        0-1.344 0-2.016 0-0.736 0-1.472 0.192-2.112 0.576s-1.216 0.96-1.568\n        1.6c-0.384 0.64-0.544 1.376-0.544 2.144 0 0.672 0 1.376 0 2.048 0 1.28 0\n        2.56 0 3.84 0 1.504 0 3.040 0 4.544 0 1.408 0 2.848 0 4.256 0 0.992 0\n        1.952 0 2.944 0 0.224 0 0.448 0 0.64 0 0.864 0.224 1.76 0.768 2.464 0.16\n        0.192 0.288 0.384 0.48 0.576s0.384 0.352 0.608 0.512c0.32 0.224 0.64\n        0.384 1.024 0.512 0.448 0.16 0.928 0.224 1.408 0.224 0.16 0 0.32 0 0.48\n        0 0.896 0 1.792 0 2.72 0 1.376 0 2.784 0 4.16 0 1.536 0 3.040 0 4.576 0\n        1.312 0 2.656 0 3.968 0 0.768 0 1.536 0 2.336 0 0.416 0 0.832-0.032\n        1.248-0.128 1.504-0.32 2.784-1.6 3.104-3.104 0.128-0.544 0.128-1.056\n        0.128-1.568 0-0.608 0-1.184 0-1.792 0-1.408 0-2.816 0-4.224 0-0.256\n        0-0.512 0-0.768\n        0-0.448-0.192-0.896-0.48-1.184s-0.768-0.512-1.184-0.48c-0.448\n        0.032-0.896 0.16-1.184 0.48-0.384 0.384-0.576 0.768-0.576 1.248v0z"}"></path><path d="${"M32 11.232c0-0.8 0-1.568 0-2.368 0-1.248 0-2.528 0-3.776 0-0.288\n        0-0.576 0-0.864 0-0.896-0.768-1.696-1.696-1.696-0.8 0-1.568 0-2.368\n        0-1.248 0-2.528 0-3.776 0-0.288 0-0.576 0-0.864 0-0.448 0-0.896\n        0.192-1.184 0.48s-0.512 0.768-0.48 1.184c0.032 0.448 0.16 0.896 0.48\n        1.184s0.736 0.48 1.184 0.48c0.8 0 1.568 0 2.368 0 1.248 0 2.528 0 3.776\n        0 0.288 0 0.576 0 0.864 0-0.576-0.576-1.12-1.12-1.696-1.696 0 0.8 0\n        1.568 0 2.368 0 1.248 0 2.528 0 3.776 0 0.288 0 0.576 0 0.864 0 0.448\n        0.192 0.896 0.48 1.184s0.768 0.512 1.184 0.48c0.448-0.032 0.896-0.16\n        1.184-0.48 0.352-0.256 0.544-0.64 0.544-1.12v0z"}"></path><path d="${"M15.040 21.888c0.16-0.16 0.288-0.288 0.448-0.448 0.384-0.384 0.8-0.8\n        1.184-1.184 0.608-0.608 1.184-1.184 1.792-1.792 0.704-0.704 1.44-1.44\n        2.176-2.176 0.8-0.8 1.568-1.568 2.368-2.368s1.6-1.6 2.4-2.4c0.736-0.736\n        1.504-1.504 2.24-2.24 0.64-0.64 1.248-1.248 1.888-1.888 0.448-0.448\n        0.896-0.896 1.344-1.344 0.224-0.224 0.448-0.416 0.64-0.64 0 0\n        0.032-0.032 0.032-0.032 0.32-0.32 0.48-0.768\n        0.48-1.184s-0.192-0.896-0.48-1.184c-0.32-0.288-0.736-0.512-1.184-0.48-0.512\n        0.032-0.928 0.16-1.248 0.48-0.16 0.16-0.288 0.288-0.448 0.448-0.384\n        0.384-0.8 0.8-1.184 1.184-0.608 0.608-1.184 1.184-1.792 1.792-0.704\n        0.704-1.44 1.44-2.176 2.176-0.8 0.8-1.568 1.568-2.368 2.368s-1.6 1.6-2.4\n        2.4c-0.736 0.736-1.504 1.504-2.24 2.24-0.64 0.64-1.248 1.248-1.888\n        1.888-0.448 0.448-0.896 0.896-1.344 1.344-0.224 0.224-0.448 0.416-0.64\n        0.64 0 0-0.032 0.032-0.032 0.032-0.32 0.32-0.48 0.768-0.48 1.184s0.192\n        0.896 0.48 1.184c0.32 0.288 0.736 0.512 1.184 0.48 0.48 0 0.928-0.16\n        1.248-0.48v0z"}"></path></symbol><symbol id="${"icon-next"}" viewBox="${"0 0 32 32"}"><title>next</title><path d="${"M2.304 18.304h14.688l-4.608 4.576c-0.864 0.864-0.864 2.336 0 3.232\n        0.864 0.864 2.336 0.864 3.232 0l8.448-8.48c0.864-0.864 0.864-2.336\n        0-3.232l-8.448-8.448c-0.448-0.448-1.056-0.672-1.632-0.672s-1.184\n        0.224-1.632 0.672c-0.864 0.864-0.864 2.336 0 3.232l4.64\n        4.576h-14.688c-1.248 0-2.304 0.992-2.304 2.272s1.024 2.272 2.304 2.272z"}"></path><path d="${"M29.696 26.752c1.248 0 2.304-1.024\n        2.304-2.304v-16.928c0-1.248-1.024-2.304-2.304-2.304s-2.304 1.024-2.304\n        2.304v16.928c0.064 1.28 1.056 2.304 2.304 2.304z"}"></path></symbol><symbol id="${"icon-prev"}" viewBox="${"0 0 32 32"}"><title>prev</title><path d="${"M29.696 13.696h-14.688l4.576-4.576c0.864-0.864 0.864-2.336\n        0-3.232-0.864-0.864-2.336-0.864-3.232 0l-8.448 8.48c-0.864 0.864-0.864\n        2.336 0 3.232l8.448 8.448c0.448 0.448 1.056 0.672 1.632\n        0.672s1.184-0.224 1.632-0.672c0.864-0.864 0.864-2.336\n        0-3.232l-4.608-4.576h14.688c1.248 0 2.304-1.024\n        2.304-2.304s-1.024-2.24-2.304-2.24z"}"></path><path d="${"M2.304 5.248c-1.248 0-2.304 1.024-2.304 2.304v16.928c0 1.248 1.024\n        2.304 2.304 2.304s2.304-1.024\n        2.304-2.304v-16.928c-0.064-1.28-1.056-2.304-2.304-2.304z"}"></path></symbol></defs></svg>`;
});

/* src\node_modules\@sapper\internal\layout.svelte generated by Svelte v3.22.2 */

const Layout = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	return `${$$slots.default ? $$slots.default({}) : ``}`;
});

/* src\node_modules\@sapper\internal\error.svelte generated by Svelte v3.22.2 */

const Error$1 = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let { error } = $$props;
	let { status } = $$props;
	if ($$props.error === void 0 && $$bindings.error && error !== void 0) $$bindings.error(error);
	if ($$props.status === void 0 && $$bindings.status && status !== void 0) $$bindings.status(status);

	return `<h1>${escape(status)}</h1>

<p>${escape(error.message)}</p>

${ ``}`;
});

// This file is generated by Sapper — do not edit it!

const manifest = {
	server_routes: [
		{
			// store/songStore.js
			pattern: /^\/store\/songStore\/?$/,
			handlers: route_0,
			params: () => ({})
		},

		{
			// db/songs.js
			pattern: /^\/db\/songs\/?$/,
			handlers: route_1,
			params: () => ({})
		}
	],

	pages: [
		{
			// index.svelte
			pattern: /^\/$/,
			parts: [
				{ name: "index", file: "index.svelte", component: Routes }
			]
		}
	],

	root: Layout,
	root_preload: () => {},
	error: Error$1
};

const build_dir = "__sapper__/build";

const CONTEXT_KEY = {};

/* src\node_modules\@sapper\internal\App.svelte generated by Svelte v3.22.2 */

const App = create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
	let { stores } = $$props;
	let { error } = $$props;
	let { status } = $$props;
	let { segments } = $$props;
	let { level0 } = $$props;
	let { level1 = null } = $$props;
	let { notify } = $$props;
	afterUpdate(notify);
	setContext(CONTEXT_KEY, stores);
	if ($$props.stores === void 0 && $$bindings.stores && stores !== void 0) $$bindings.stores(stores);
	if ($$props.error === void 0 && $$bindings.error && error !== void 0) $$bindings.error(error);
	if ($$props.status === void 0 && $$bindings.status && status !== void 0) $$bindings.status(status);
	if ($$props.segments === void 0 && $$bindings.segments && segments !== void 0) $$bindings.segments(segments);
	if ($$props.level0 === void 0 && $$bindings.level0 && level0 !== void 0) $$bindings.level0(level0);
	if ($$props.level1 === void 0 && $$bindings.level1 && level1 !== void 0) $$bindings.level1(level1);
	if ($$props.notify === void 0 && $$bindings.notify && notify !== void 0) $$bindings.notify(notify);

	return `


${validate_component(Layout, "Layout").$$render($$result, Object.assign({ segment: segments[0] }, level0.props), {}, {
		default: () => `${error
		? `${validate_component(Error$1, "Error").$$render($$result, { error, status }, {}, {})}`
		: `${validate_component(level1.component || missing_component, "svelte:component").$$render($$result, Object.assign(level1.props), {}, {})}`}`
	})}`;
});

/**
 * @param typeMap [Object] Map of MIME type -> Array[extensions]
 * @param ...
 */
function Mime() {
  this._types = Object.create(null);
  this._extensions = Object.create(null);

  for (var i = 0; i < arguments.length; i++) {
    this.define(arguments[i]);
  }

  this.define = this.define.bind(this);
  this.getType = this.getType.bind(this);
  this.getExtension = this.getExtension.bind(this);
}

/**
 * Define mimetype -> extension mappings.  Each key is a mime-type that maps
 * to an array of extensions associated with the type.  The first extension is
 * used as the default extension for the type.
 *
 * e.g. mime.define({'audio/ogg', ['oga', 'ogg', 'spx']});
 *
 * If a type declares an extension that has already been defined, an error will
 * be thrown.  To suppress this error and force the extension to be associated
 * with the new type, pass `force`=true.  Alternatively, you may prefix the
 * extension with "*" to map the type to extension, without mapping the
 * extension to the type.
 *
 * e.g. mime.define({'audio/wav', ['wav']}, {'audio/x-wav', ['*wav']});
 *
 *
 * @param map (Object) type definitions
 * @param force (Boolean) if true, force overriding of existing definitions
 */
Mime.prototype.define = function(typeMap, force) {
  for (var type in typeMap) {
    var extensions = typeMap[type].map(function(t) {return t.toLowerCase()});
    type = type.toLowerCase();

    for (var i = 0; i < extensions.length; i++) {
      var ext = extensions[i];

      // '*' prefix = not the preferred type for this extension.  So fixup the
      // extension, and skip it.
      if (ext[0] == '*') {
        continue;
      }

      if (!force && (ext in this._types)) {
        throw new Error(
          'Attempt to change mapping for "' + ext +
          '" extension from "' + this._types[ext] + '" to "' + type +
          '". Pass `force=true` to allow this, otherwise remove "' + ext +
          '" from the list of extensions for "' + type + '".'
        );
      }

      this._types[ext] = type;
    }

    // Use first extension as default
    if (force || !this._extensions[type]) {
      var ext = extensions[0];
      this._extensions[type] = (ext[0] != '*') ? ext : ext.substr(1);
    }
  }
};

/**
 * Lookup a mime type based on extension
 */
Mime.prototype.getType = function(path) {
  path = String(path);
  var last = path.replace(/^.*[/\\]/, '').toLowerCase();
  var ext = last.replace(/^.*\./, '').toLowerCase();

  var hasPath = last.length < path.length;
  var hasDot = ext.length < last.length - 1;

  return (hasDot || !hasPath) && this._types[ext] || null;
};

/**
 * Return file extension associated with a mime type
 */
Mime.prototype.getExtension = function(type) {
  type = /^\s*([^;\s]*)/.test(type) && RegExp.$1;
  return type && this._extensions[type.toLowerCase()] || null;
};

var Mime_1 = Mime;

var standard = {"application/andrew-inset":["ez"],"application/applixware":["aw"],"application/atom+xml":["atom"],"application/atomcat+xml":["atomcat"],"application/atomsvc+xml":["atomsvc"],"application/bdoc":["bdoc"],"application/ccxml+xml":["ccxml"],"application/cdmi-capability":["cdmia"],"application/cdmi-container":["cdmic"],"application/cdmi-domain":["cdmid"],"application/cdmi-object":["cdmio"],"application/cdmi-queue":["cdmiq"],"application/cu-seeme":["cu"],"application/dash+xml":["mpd"],"application/davmount+xml":["davmount"],"application/docbook+xml":["dbk"],"application/dssc+der":["dssc"],"application/dssc+xml":["xdssc"],"application/ecmascript":["ecma","es"],"application/emma+xml":["emma"],"application/epub+zip":["epub"],"application/exi":["exi"],"application/font-tdpfr":["pfr"],"application/geo+json":["geojson"],"application/gml+xml":["gml"],"application/gpx+xml":["gpx"],"application/gxf":["gxf"],"application/gzip":["gz"],"application/hjson":["hjson"],"application/hyperstudio":["stk"],"application/inkml+xml":["ink","inkml"],"application/ipfix":["ipfix"],"application/java-archive":["jar","war","ear"],"application/java-serialized-object":["ser"],"application/java-vm":["class"],"application/javascript":["js","mjs"],"application/json":["json","map"],"application/json5":["json5"],"application/jsonml+json":["jsonml"],"application/ld+json":["jsonld"],"application/lost+xml":["lostxml"],"application/mac-binhex40":["hqx"],"application/mac-compactpro":["cpt"],"application/mads+xml":["mads"],"application/manifest+json":["webmanifest"],"application/marc":["mrc"],"application/marcxml+xml":["mrcx"],"application/mathematica":["ma","nb","mb"],"application/mathml+xml":["mathml"],"application/mbox":["mbox"],"application/mediaservercontrol+xml":["mscml"],"application/metalink+xml":["metalink"],"application/metalink4+xml":["meta4"],"application/mets+xml":["mets"],"application/mods+xml":["mods"],"application/mp21":["m21","mp21"],"application/mp4":["mp4s","m4p"],"application/msword":["doc","dot"],"application/mxf":["mxf"],"application/n-quads":["nq"],"application/n-triples":["nt"],"application/octet-stream":["bin","dms","lrf","mar","so","dist","distz","pkg","bpk","dump","elc","deploy","exe","dll","deb","dmg","iso","img","msi","msp","msm","buffer"],"application/oda":["oda"],"application/oebps-package+xml":["opf"],"application/ogg":["ogx"],"application/omdoc+xml":["omdoc"],"application/onenote":["onetoc","onetoc2","onetmp","onepkg"],"application/oxps":["oxps"],"application/patch-ops-error+xml":["xer"],"application/pdf":["pdf"],"application/pgp-encrypted":["pgp"],"application/pgp-signature":["asc","sig"],"application/pics-rules":["prf"],"application/pkcs10":["p10"],"application/pkcs7-mime":["p7m","p7c"],"application/pkcs7-signature":["p7s"],"application/pkcs8":["p8"],"application/pkix-attr-cert":["ac"],"application/pkix-cert":["cer"],"application/pkix-crl":["crl"],"application/pkix-pkipath":["pkipath"],"application/pkixcmp":["pki"],"application/pls+xml":["pls"],"application/postscript":["ai","eps","ps"],"application/pskc+xml":["pskcxml"],"application/raml+yaml":["raml"],"application/rdf+xml":["rdf","owl"],"application/reginfo+xml":["rif"],"application/relax-ng-compact-syntax":["rnc"],"application/resource-lists+xml":["rl"],"application/resource-lists-diff+xml":["rld"],"application/rls-services+xml":["rs"],"application/rpki-ghostbusters":["gbr"],"application/rpki-manifest":["mft"],"application/rpki-roa":["roa"],"application/rsd+xml":["rsd"],"application/rss+xml":["rss"],"application/rtf":["rtf"],"application/sbml+xml":["sbml"],"application/scvp-cv-request":["scq"],"application/scvp-cv-response":["scs"],"application/scvp-vp-request":["spq"],"application/scvp-vp-response":["spp"],"application/sdp":["sdp"],"application/set-payment-initiation":["setpay"],"application/set-registration-initiation":["setreg"],"application/shf+xml":["shf"],"application/sieve":["siv","sieve"],"application/smil+xml":["smi","smil"],"application/sparql-query":["rq"],"application/sparql-results+xml":["srx"],"application/srgs":["gram"],"application/srgs+xml":["grxml"],"application/sru+xml":["sru"],"application/ssdl+xml":["ssdl"],"application/ssml+xml":["ssml"],"application/tei+xml":["tei","teicorpus"],"application/thraud+xml":["tfi"],"application/timestamped-data":["tsd"],"application/voicexml+xml":["vxml"],"application/wasm":["wasm"],"application/widget":["wgt"],"application/winhlp":["hlp"],"application/wsdl+xml":["wsdl"],"application/wspolicy+xml":["wspolicy"],"application/xaml+xml":["xaml"],"application/xcap-diff+xml":["xdf"],"application/xenc+xml":["xenc"],"application/xhtml+xml":["xhtml","xht"],"application/xml":["xml","xsl","xsd","rng"],"application/xml-dtd":["dtd"],"application/xop+xml":["xop"],"application/xproc+xml":["xpl"],"application/xslt+xml":["xslt"],"application/xspf+xml":["xspf"],"application/xv+xml":["mxml","xhvml","xvml","xvm"],"application/yang":["yang"],"application/yin+xml":["yin"],"application/zip":["zip"],"audio/3gpp":["*3gpp"],"audio/adpcm":["adp"],"audio/basic":["au","snd"],"audio/midi":["mid","midi","kar","rmi"],"audio/mp3":["*mp3"],"audio/mp4":["m4a","mp4a"],"audio/mpeg":["mpga","mp2","mp2a","mp3","m2a","m3a"],"audio/ogg":["oga","ogg","spx"],"audio/s3m":["s3m"],"audio/silk":["sil"],"audio/wav":["wav"],"audio/wave":["*wav"],"audio/webm":["weba"],"audio/xm":["xm"],"font/collection":["ttc"],"font/otf":["otf"],"font/ttf":["ttf"],"font/woff":["woff"],"font/woff2":["woff2"],"image/aces":["exr"],"image/apng":["apng"],"image/bmp":["bmp"],"image/cgm":["cgm"],"image/dicom-rle":["drle"],"image/emf":["emf"],"image/fits":["fits"],"image/g3fax":["g3"],"image/gif":["gif"],"image/heic":["heic"],"image/heic-sequence":["heics"],"image/heif":["heif"],"image/heif-sequence":["heifs"],"image/ief":["ief"],"image/jls":["jls"],"image/jp2":["jp2","jpg2"],"image/jpeg":["jpeg","jpg","jpe"],"image/jpm":["jpm"],"image/jpx":["jpx","jpf"],"image/jxr":["jxr"],"image/ktx":["ktx"],"image/png":["png"],"image/sgi":["sgi"],"image/svg+xml":["svg","svgz"],"image/t38":["t38"],"image/tiff":["tif","tiff"],"image/tiff-fx":["tfx"],"image/webp":["webp"],"image/wmf":["wmf"],"message/disposition-notification":["disposition-notification"],"message/global":["u8msg"],"message/global-delivery-status":["u8dsn"],"message/global-disposition-notification":["u8mdn"],"message/global-headers":["u8hdr"],"message/rfc822":["eml","mime"],"model/3mf":["3mf"],"model/gltf+json":["gltf"],"model/gltf-binary":["glb"],"model/iges":["igs","iges"],"model/mesh":["msh","mesh","silo"],"model/stl":["stl"],"model/vrml":["wrl","vrml"],"model/x3d+binary":["*x3db","x3dbz"],"model/x3d+fastinfoset":["x3db"],"model/x3d+vrml":["*x3dv","x3dvz"],"model/x3d+xml":["x3d","x3dz"],"model/x3d-vrml":["x3dv"],"text/cache-manifest":["appcache","manifest"],"text/calendar":["ics","ifb"],"text/coffeescript":["coffee","litcoffee"],"text/css":["css"],"text/csv":["csv"],"text/html":["html","htm","shtml"],"text/jade":["jade"],"text/jsx":["jsx"],"text/less":["less"],"text/markdown":["markdown","md"],"text/mathml":["mml"],"text/mdx":["mdx"],"text/n3":["n3"],"text/plain":["txt","text","conf","def","list","log","in","ini"],"text/richtext":["rtx"],"text/rtf":["*rtf"],"text/sgml":["sgml","sgm"],"text/shex":["shex"],"text/slim":["slim","slm"],"text/stylus":["stylus","styl"],"text/tab-separated-values":["tsv"],"text/troff":["t","tr","roff","man","me","ms"],"text/turtle":["ttl"],"text/uri-list":["uri","uris","urls"],"text/vcard":["vcard"],"text/vtt":["vtt"],"text/xml":["*xml"],"text/yaml":["yaml","yml"],"video/3gpp":["3gp","3gpp"],"video/3gpp2":["3g2"],"video/h261":["h261"],"video/h263":["h263"],"video/h264":["h264"],"video/jpeg":["jpgv"],"video/jpm":["*jpm","jpgm"],"video/mj2":["mj2","mjp2"],"video/mp2t":["ts"],"video/mp4":["mp4","mp4v","mpg4"],"video/mpeg":["mpeg","mpg","mpe","m1v","m2v"],"video/ogg":["ogv"],"video/quicktime":["qt","mov"],"video/webm":["webm"]};

var lite = new Mime_1(standard);

function get_server_route_handler(routes) {
	async function handle_route(route, req, res, next) {
		req.params = route.params(route.pattern.exec(req.path));

		const method = req.method.toLowerCase();
		// 'delete' cannot be exported from a module because it is a keyword,
		// so check for 'del' instead
		const method_export = method === 'delete' ? 'del' : method;
		const handle_method = route.handlers[method_export];
		if (handle_method) {
			if (process.env.SAPPER_EXPORT) {
				const { write, end, setHeader } = res;
				const chunks = [];
				const headers = {};

				// intercept data so that it can be exported
				res.write = function(chunk) {
					chunks.push(Buffer.from(chunk));
					write.apply(res, arguments);
				};

				res.setHeader = function(name, value) {
					headers[name.toLowerCase()] = value;
					setHeader.apply(res, arguments);
				};

				res.end = function(chunk) {
					if (chunk) chunks.push(Buffer.from(chunk));
					end.apply(res, arguments);

					process.send({
						__sapper__: true,
						event: 'file',
						url: req.url,
						method: req.method,
						status: res.statusCode,
						type: headers['content-type'],
						body: Buffer.concat(chunks).toString()
					});
				};
			}

			const handle_next = (err) => {
				if (err) {
					res.statusCode = 500;
					res.end(err.message);
				} else {
					process.nextTick(next);
				}
			};

			try {
				await handle_method(req, res, handle_next);
			} catch (err) {
				console.error(err);
				handle_next(err);
			}
		} else {
			// no matching handler for method
			process.nextTick(next);
		}
	}

	return function find_route(req, res, next) {
		for (const route of routes) {
			if (route.pattern.test(req.path)) {
				handle_route(route, req, res, next);
				return;
			}
		}

		next();
	};
}

/*!
 * cookie
 * Copyright(c) 2012-2014 Roman Shtylman
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module exports.
 * @public
 */

var parse_1 = parse;
var serialize_1 = serialize;

/**
 * Module variables.
 * @private
 */

var decode = decodeURIComponent;
var encode = encodeURIComponent;
var pairSplitRegExp = /; */;

/**
 * RegExp to match field-content in RFC 7230 sec 3.2
 *
 * field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]
 * field-vchar   = VCHAR / obs-text
 * obs-text      = %x80-FF
 */

var fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;

/**
 * Parse a cookie header.
 *
 * Parse the given cookie header string into an object
 * The object has the various cookies as keys(names) => values
 *
 * @param {string} str
 * @param {object} [options]
 * @return {object}
 * @public
 */

function parse(str, options) {
  if (typeof str !== 'string') {
    throw new TypeError('argument str must be a string');
  }

  var obj = {};
  var opt = options || {};
  var pairs = str.split(pairSplitRegExp);
  var dec = opt.decode || decode;

  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i];
    var eq_idx = pair.indexOf('=');

    // skip things that don't look like key=value
    if (eq_idx < 0) {
      continue;
    }

    var key = pair.substr(0, eq_idx).trim();
    var val = pair.substr(++eq_idx, pair.length).trim();

    // quoted values
    if ('"' == val[0]) {
      val = val.slice(1, -1);
    }

    // only assign once
    if (undefined == obj[key]) {
      obj[key] = tryDecode(val, dec);
    }
  }

  return obj;
}

/**
 * Serialize data into a cookie header.
 *
 * Serialize the a name value pair into a cookie string suitable for
 * http headers. An optional options object specified cookie parameters.
 *
 * serialize('foo', 'bar', { httpOnly: true })
 *   => "foo=bar; httpOnly"
 *
 * @param {string} name
 * @param {string} val
 * @param {object} [options]
 * @return {string}
 * @public
 */

function serialize(name, val, options) {
  var opt = options || {};
  var enc = opt.encode || encode;

  if (typeof enc !== 'function') {
    throw new TypeError('option encode is invalid');
  }

  if (!fieldContentRegExp.test(name)) {
    throw new TypeError('argument name is invalid');
  }

  var value = enc(val);

  if (value && !fieldContentRegExp.test(value)) {
    throw new TypeError('argument val is invalid');
  }

  var str = name + '=' + value;

  if (null != opt.maxAge) {
    var maxAge = opt.maxAge - 0;
    if (isNaN(maxAge)) throw new Error('maxAge should be a Number');
    str += '; Max-Age=' + Math.floor(maxAge);
  }

  if (opt.domain) {
    if (!fieldContentRegExp.test(opt.domain)) {
      throw new TypeError('option domain is invalid');
    }

    str += '; Domain=' + opt.domain;
  }

  if (opt.path) {
    if (!fieldContentRegExp.test(opt.path)) {
      throw new TypeError('option path is invalid');
    }

    str += '; Path=' + opt.path;
  }

  if (opt.expires) {
    if (typeof opt.expires.toUTCString !== 'function') {
      throw new TypeError('option expires is invalid');
    }

    str += '; Expires=' + opt.expires.toUTCString();
  }

  if (opt.httpOnly) {
    str += '; HttpOnly';
  }

  if (opt.secure) {
    str += '; Secure';
  }

  if (opt.sameSite) {
    var sameSite = typeof opt.sameSite === 'string'
      ? opt.sameSite.toLowerCase() : opt.sameSite;

    switch (sameSite) {
      case true:
        str += '; SameSite=Strict';
        break;
      case 'lax':
        str += '; SameSite=Lax';
        break;
      case 'strict':
        str += '; SameSite=Strict';
        break;
      case 'none':
        str += '; SameSite=None';
        break;
      default:
        throw new TypeError('option sameSite is invalid');
    }
  }

  return str;
}

/**
 * Try decoding a string using a decoding function.
 *
 * @param {string} str
 * @param {function} decode
 * @private
 */

function tryDecode(str, decode) {
  try {
    return decode(str);
  } catch (e) {
    return str;
  }
}

var cookie = {
	parse: parse_1,
	serialize: serialize_1
};

var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$';
var unsafeChars = /[<>\b\f\n\r\t\0\u2028\u2029]/g;
var reserved = /^(?:do|if|in|for|int|let|new|try|var|byte|case|char|else|enum|goto|long|this|void|with|await|break|catch|class|const|final|float|short|super|throw|while|yield|delete|double|export|import|native|return|switch|throws|typeof|boolean|default|extends|finally|package|private|abstract|continue|debugger|function|volatile|interface|protected|transient|implements|instanceof|synchronized)$/;
var escaped$1 = {
    '<': '\\u003C',
    '>': '\\u003E',
    '/': '\\u002F',
    '\\': '\\\\',
    '\b': '\\b',
    '\f': '\\f',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '\0': '\\0',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029'
};
var objectProtoOwnPropertyNames = Object.getOwnPropertyNames(Object.prototype).sort().join('\0');
function devalue(value) {
    var counts = new Map();
    function walk(thing) {
        if (typeof thing === 'function') {
            throw new Error("Cannot stringify a function");
        }
        if (counts.has(thing)) {
            counts.set(thing, counts.get(thing) + 1);
            return;
        }
        counts.set(thing, 1);
        if (!isPrimitive(thing)) {
            var type = getType(thing);
            switch (type) {
                case 'Number':
                case 'String':
                case 'Boolean':
                case 'Date':
                case 'RegExp':
                    return;
                case 'Array':
                    thing.forEach(walk);
                    break;
                case 'Set':
                case 'Map':
                    Array.from(thing).forEach(walk);
                    break;
                default:
                    var proto = Object.getPrototypeOf(thing);
                    if (proto !== Object.prototype &&
                        proto !== null &&
                        Object.getOwnPropertyNames(proto).sort().join('\0') !== objectProtoOwnPropertyNames) {
                        throw new Error("Cannot stringify arbitrary non-POJOs");
                    }
                    if (Object.getOwnPropertySymbols(thing).length > 0) {
                        throw new Error("Cannot stringify POJOs with symbolic keys");
                    }
                    Object.keys(thing).forEach(function (key) { return walk(thing[key]); });
            }
        }
    }
    walk(value);
    var names = new Map();
    Array.from(counts)
        .filter(function (entry) { return entry[1] > 1; })
        .sort(function (a, b) { return b[1] - a[1]; })
        .forEach(function (entry, i) {
        names.set(entry[0], getName(i));
    });
    function stringify(thing) {
        if (names.has(thing)) {
            return names.get(thing);
        }
        if (isPrimitive(thing)) {
            return stringifyPrimitive(thing);
        }
        var type = getType(thing);
        switch (type) {
            case 'Number':
            case 'String':
            case 'Boolean':
                return "Object(" + stringify(thing.valueOf()) + ")";
            case 'RegExp':
                return thing.toString();
            case 'Date':
                return "new Date(" + thing.getTime() + ")";
            case 'Array':
                var members = thing.map(function (v, i) { return i in thing ? stringify(v) : ''; });
                var tail = thing.length === 0 || (thing.length - 1 in thing) ? '' : ',';
                return "[" + members.join(',') + tail + "]";
            case 'Set':
            case 'Map':
                return "new " + type + "([" + Array.from(thing).map(stringify).join(',') + "])";
            default:
                var obj = "{" + Object.keys(thing).map(function (key) { return safeKey(key) + ":" + stringify(thing[key]); }).join(',') + "}";
                var proto = Object.getPrototypeOf(thing);
                if (proto === null) {
                    return Object.keys(thing).length > 0
                        ? "Object.assign(Object.create(null)," + obj + ")"
                        : "Object.create(null)";
                }
                return obj;
        }
    }
    var str = stringify(value);
    if (names.size) {
        var params_1 = [];
        var statements_1 = [];
        var values_1 = [];
        names.forEach(function (name, thing) {
            params_1.push(name);
            if (isPrimitive(thing)) {
                values_1.push(stringifyPrimitive(thing));
                return;
            }
            var type = getType(thing);
            switch (type) {
                case 'Number':
                case 'String':
                case 'Boolean':
                    values_1.push("Object(" + stringify(thing.valueOf()) + ")");
                    break;
                case 'RegExp':
                    values_1.push(thing.toString());
                    break;
                case 'Date':
                    values_1.push("new Date(" + thing.getTime() + ")");
                    break;
                case 'Array':
                    values_1.push("Array(" + thing.length + ")");
                    thing.forEach(function (v, i) {
                        statements_1.push(name + "[" + i + "]=" + stringify(v));
                    });
                    break;
                case 'Set':
                    values_1.push("new Set");
                    statements_1.push(name + "." + Array.from(thing).map(function (v) { return "add(" + stringify(v) + ")"; }).join('.'));
                    break;
                case 'Map':
                    values_1.push("new Map");
                    statements_1.push(name + "." + Array.from(thing).map(function (_a) {
                        var k = _a[0], v = _a[1];
                        return "set(" + stringify(k) + ", " + stringify(v) + ")";
                    }).join('.'));
                    break;
                default:
                    values_1.push(Object.getPrototypeOf(thing) === null ? 'Object.create(null)' : '{}');
                    Object.keys(thing).forEach(function (key) {
                        statements_1.push("" + name + safeProp(key) + "=" + stringify(thing[key]));
                    });
            }
        });
        statements_1.push("return " + str);
        return "(function(" + params_1.join(',') + "){" + statements_1.join(';') + "}(" + values_1.join(',') + "))";
    }
    else {
        return str;
    }
}
function getName(num) {
    var name = '';
    do {
        name = chars[num % chars.length] + name;
        num = ~~(num / chars.length) - 1;
    } while (num >= 0);
    return reserved.test(name) ? name + "_" : name;
}
function isPrimitive(thing) {
    return Object(thing) !== thing;
}
function stringifyPrimitive(thing) {
    if (typeof thing === 'string')
        return stringifyString(thing);
    if (thing === void 0)
        return 'void 0';
    if (thing === 0 && 1 / thing < 0)
        return '-0';
    var str = String(thing);
    if (typeof thing === 'number')
        return str.replace(/^(-)?0\./, '$1.');
    return str;
}
function getType(thing) {
    return Object.prototype.toString.call(thing).slice(8, -1);
}
function escapeUnsafeChar(c) {
    return escaped$1[c] || c;
}
function escapeUnsafeChars(str) {
    return str.replace(unsafeChars, escapeUnsafeChar);
}
function safeKey(key) {
    return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? key : escapeUnsafeChars(JSON.stringify(key));
}
function safeProp(key) {
    return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? "." + key : "[" + escapeUnsafeChars(JSON.stringify(key)) + "]";
}
function stringifyString(str) {
    var result = '"';
    for (var i = 0; i < str.length; i += 1) {
        var char = str.charAt(i);
        var code = char.charCodeAt(0);
        if (char === '"') {
            result += '\\"';
        }
        else if (char in escaped$1) {
            result += escaped$1[char];
        }
        else if (code >= 0xd800 && code <= 0xdfff) {
            var next = str.charCodeAt(i + 1);
            // If this is the beginning of a [high, low] surrogate pair,
            // add the next two characters, otherwise escape
            if (code <= 0xdbff && (next >= 0xdc00 && next <= 0xdfff)) {
                result += char + str[++i];
            }
            else {
                result += "\\u" + code.toString(16).toUpperCase();
            }
        }
        else {
            result += char;
        }
    }
    result += '"';
    return result;
}

// Based on https://github.com/tmpvar/jsdom/blob/aa85b2abf07766ff7bf5c1f6daafb3726f2f2db5/lib/jsdom/living/blob.js

// fix for "Readable" isn't a named export issue
const Readable = Stream.Readable;

const BUFFER = Symbol('buffer');
const TYPE = Symbol('type');

class Blob {
	constructor() {
		this[TYPE] = '';

		const blobParts = arguments[0];
		const options = arguments[1];

		const buffers = [];
		let size = 0;

		if (blobParts) {
			const a = blobParts;
			const length = Number(a.length);
			for (let i = 0; i < length; i++) {
				const element = a[i];
				let buffer;
				if (element instanceof Buffer) {
					buffer = element;
				} else if (ArrayBuffer.isView(element)) {
					buffer = Buffer.from(element.buffer, element.byteOffset, element.byteLength);
				} else if (element instanceof ArrayBuffer) {
					buffer = Buffer.from(element);
				} else if (element instanceof Blob) {
					buffer = element[BUFFER];
				} else {
					buffer = Buffer.from(typeof element === 'string' ? element : String(element));
				}
				size += buffer.length;
				buffers.push(buffer);
			}
		}

		this[BUFFER] = Buffer.concat(buffers);

		let type = options && options.type !== undefined && String(options.type).toLowerCase();
		if (type && !/[^\u0020-\u007E]/.test(type)) {
			this[TYPE] = type;
		}
	}
	get size() {
		return this[BUFFER].length;
	}
	get type() {
		return this[TYPE];
	}
	text() {
		return Promise.resolve(this[BUFFER].toString());
	}
	arrayBuffer() {
		const buf = this[BUFFER];
		const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
		return Promise.resolve(ab);
	}
	stream() {
		const readable = new Readable();
		readable._read = function () {};
		readable.push(this[BUFFER]);
		readable.push(null);
		return readable;
	}
	toString() {
		return '[object Blob]';
	}
	slice() {
		const size = this.size;

		const start = arguments[0];
		const end = arguments[1];
		let relativeStart, relativeEnd;
		if (start === undefined) {
			relativeStart = 0;
		} else if (start < 0) {
			relativeStart = Math.max(size + start, 0);
		} else {
			relativeStart = Math.min(start, size);
		}
		if (end === undefined) {
			relativeEnd = size;
		} else if (end < 0) {
			relativeEnd = Math.max(size + end, 0);
		} else {
			relativeEnd = Math.min(end, size);
		}
		const span = Math.max(relativeEnd - relativeStart, 0);

		const buffer = this[BUFFER];
		const slicedBuffer = buffer.slice(relativeStart, relativeStart + span);
		const blob = new Blob([], { type: arguments[2] });
		blob[BUFFER] = slicedBuffer;
		return blob;
	}
}

Object.defineProperties(Blob.prototype, {
	size: { enumerable: true },
	type: { enumerable: true },
	slice: { enumerable: true }
});

Object.defineProperty(Blob.prototype, Symbol.toStringTag, {
	value: 'Blob',
	writable: false,
	enumerable: false,
	configurable: true
});

/**
 * fetch-error.js
 *
 * FetchError interface for operational errors
 */

/**
 * Create FetchError instance
 *
 * @param   String      message      Error message for human
 * @param   String      type         Error type for machine
 * @param   String      systemError  For Node.js system error
 * @return  FetchError
 */
function FetchError(message, type, systemError) {
  Error.call(this, message);

  this.message = message;
  this.type = type;

  // when err.type is `system`, err.code contains system error code
  if (systemError) {
    this.code = this.errno = systemError.code;
  }

  // hide custom error implementation details from end-users
  Error.captureStackTrace(this, this.constructor);
}

FetchError.prototype = Object.create(Error.prototype);
FetchError.prototype.constructor = FetchError;
FetchError.prototype.name = 'FetchError';

let convert;
try {
	convert = require('encoding').convert;
} catch (e) {}

const INTERNALS = Symbol('Body internals');

// fix an issue where "PassThrough" isn't a named export for node <10
const PassThrough = Stream.PassThrough;

/**
 * Body mixin
 *
 * Ref: https://fetch.spec.whatwg.org/#body
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
function Body(body) {
	var _this = this;

	var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
	    _ref$size = _ref.size;

	let size = _ref$size === undefined ? 0 : _ref$size;
	var _ref$timeout = _ref.timeout;
	let timeout = _ref$timeout === undefined ? 0 : _ref$timeout;

	if (body == null) {
		// body is undefined or null
		body = null;
	} else if (isURLSearchParams(body)) {
		// body is a URLSearchParams
		body = Buffer.from(body.toString());
	} else if (isBlob(body)) ; else if (Buffer.isBuffer(body)) ; else if (Object.prototype.toString.call(body) === '[object ArrayBuffer]') {
		// body is ArrayBuffer
		body = Buffer.from(body);
	} else if (ArrayBuffer.isView(body)) {
		// body is ArrayBufferView
		body = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
	} else if (body instanceof Stream) ; else {
		// none of the above
		// coerce to string then buffer
		body = Buffer.from(String(body));
	}
	this[INTERNALS] = {
		body,
		disturbed: false,
		error: null
	};
	this.size = size;
	this.timeout = timeout;

	if (body instanceof Stream) {
		body.on('error', function (err) {
			const error = err.name === 'AbortError' ? err : new FetchError(`Invalid response body while trying to fetch ${_this.url}: ${err.message}`, 'system', err);
			_this[INTERNALS].error = error;
		});
	}
}

Body.prototype = {
	get body() {
		return this[INTERNALS].body;
	},

	get bodyUsed() {
		return this[INTERNALS].disturbed;
	},

	/**
  * Decode response as ArrayBuffer
  *
  * @return  Promise
  */
	arrayBuffer() {
		return consumeBody.call(this).then(function (buf) {
			return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
		});
	},

	/**
  * Return raw response as Blob
  *
  * @return Promise
  */
	blob() {
		let ct = this.headers && this.headers.get('content-type') || '';
		return consumeBody.call(this).then(function (buf) {
			return Object.assign(
			// Prevent copying
			new Blob([], {
				type: ct.toLowerCase()
			}), {
				[BUFFER]: buf
			});
		});
	},

	/**
  * Decode response as json
  *
  * @return  Promise
  */
	json() {
		var _this2 = this;

		return consumeBody.call(this).then(function (buffer) {
			try {
				return JSON.parse(buffer.toString());
			} catch (err) {
				return Body.Promise.reject(new FetchError(`invalid json response body at ${_this2.url} reason: ${err.message}`, 'invalid-json'));
			}
		});
	},

	/**
  * Decode response as text
  *
  * @return  Promise
  */
	text() {
		return consumeBody.call(this).then(function (buffer) {
			return buffer.toString();
		});
	},

	/**
  * Decode response as buffer (non-spec api)
  *
  * @return  Promise
  */
	buffer() {
		return consumeBody.call(this);
	},

	/**
  * Decode response as text, while automatically detecting the encoding and
  * trying to decode to UTF-8 (non-spec api)
  *
  * @return  Promise
  */
	textConverted() {
		var _this3 = this;

		return consumeBody.call(this).then(function (buffer) {
			return convertBody(buffer, _this3.headers);
		});
	}
};

// In browsers, all properties are enumerable.
Object.defineProperties(Body.prototype, {
	body: { enumerable: true },
	bodyUsed: { enumerable: true },
	arrayBuffer: { enumerable: true },
	blob: { enumerable: true },
	json: { enumerable: true },
	text: { enumerable: true }
});

Body.mixIn = function (proto) {
	for (const name of Object.getOwnPropertyNames(Body.prototype)) {
		// istanbul ignore else: future proof
		if (!(name in proto)) {
			const desc = Object.getOwnPropertyDescriptor(Body.prototype, name);
			Object.defineProperty(proto, name, desc);
		}
	}
};

/**
 * Consume and convert an entire Body to a Buffer.
 *
 * Ref: https://fetch.spec.whatwg.org/#concept-body-consume-body
 *
 * @return  Promise
 */
function consumeBody() {
	var _this4 = this;

	if (this[INTERNALS].disturbed) {
		return Body.Promise.reject(new TypeError(`body used already for: ${this.url}`));
	}

	this[INTERNALS].disturbed = true;

	if (this[INTERNALS].error) {
		return Body.Promise.reject(this[INTERNALS].error);
	}

	let body = this.body;

	// body is null
	if (body === null) {
		return Body.Promise.resolve(Buffer.alloc(0));
	}

	// body is blob
	if (isBlob(body)) {
		body = body.stream();
	}

	// body is buffer
	if (Buffer.isBuffer(body)) {
		return Body.Promise.resolve(body);
	}

	// istanbul ignore if: should never happen
	if (!(body instanceof Stream)) {
		return Body.Promise.resolve(Buffer.alloc(0));
	}

	// body is stream
	// get ready to actually consume the body
	let accum = [];
	let accumBytes = 0;
	let abort = false;

	return new Body.Promise(function (resolve, reject) {
		let resTimeout;

		// allow timeout on slow response body
		if (_this4.timeout) {
			resTimeout = setTimeout(function () {
				abort = true;
				reject(new FetchError(`Response timeout while trying to fetch ${_this4.url} (over ${_this4.timeout}ms)`, 'body-timeout'));
			}, _this4.timeout);
		}

		// handle stream errors
		body.on('error', function (err) {
			if (err.name === 'AbortError') {
				// if the request was aborted, reject with this Error
				abort = true;
				reject(err);
			} else {
				// other errors, such as incorrect content-encoding
				reject(new FetchError(`Invalid response body while trying to fetch ${_this4.url}: ${err.message}`, 'system', err));
			}
		});

		body.on('data', function (chunk) {
			if (abort || chunk === null) {
				return;
			}

			if (_this4.size && accumBytes + chunk.length > _this4.size) {
				abort = true;
				reject(new FetchError(`content size at ${_this4.url} over limit: ${_this4.size}`, 'max-size'));
				return;
			}

			accumBytes += chunk.length;
			accum.push(chunk);
		});

		body.on('end', function () {
			if (abort) {
				return;
			}

			clearTimeout(resTimeout);

			try {
				resolve(Buffer.concat(accum, accumBytes));
			} catch (err) {
				// handle streams that have accumulated too much data (issue #414)
				reject(new FetchError(`Could not create Buffer from response body for ${_this4.url}: ${err.message}`, 'system', err));
			}
		});
	});
}

/**
 * Detect buffer encoding and convert to target encoding
 * ref: http://www.w3.org/TR/2011/WD-html5-20110113/parsing.html#determining-the-character-encoding
 *
 * @param   Buffer  buffer    Incoming buffer
 * @param   String  encoding  Target encoding
 * @return  String
 */
function convertBody(buffer, headers) {
	if (typeof convert !== 'function') {
		throw new Error('The package `encoding` must be installed to use the textConverted() function');
	}

	const ct = headers.get('content-type');
	let charset = 'utf-8';
	let res, str;

	// header
	if (ct) {
		res = /charset=([^;]*)/i.exec(ct);
	}

	// no charset in content type, peek at response body for at most 1024 bytes
	str = buffer.slice(0, 1024).toString();

	// html5
	if (!res && str) {
		res = /<meta.+?charset=(['"])(.+?)\1/i.exec(str);
	}

	// html4
	if (!res && str) {
		res = /<meta[\s]+?http-equiv=(['"])content-type\1[\s]+?content=(['"])(.+?)\2/i.exec(str);

		if (res) {
			res = /charset=(.*)/i.exec(res.pop());
		}
	}

	// xml
	if (!res && str) {
		res = /<\?xml.+?encoding=(['"])(.+?)\1/i.exec(str);
	}

	// found charset
	if (res) {
		charset = res.pop();

		// prevent decode issues when sites use incorrect encoding
		// ref: https://hsivonen.fi/encoding-menu/
		if (charset === 'gb2312' || charset === 'gbk') {
			charset = 'gb18030';
		}
	}

	// turn raw buffers into a single utf-8 buffer
	return convert(buffer, 'UTF-8', charset).toString();
}

/**
 * Detect a URLSearchParams object
 * ref: https://github.com/bitinn/node-fetch/issues/296#issuecomment-307598143
 *
 * @param   Object  obj     Object to detect by type or brand
 * @return  String
 */
function isURLSearchParams(obj) {
	// Duck-typing as a necessary condition.
	if (typeof obj !== 'object' || typeof obj.append !== 'function' || typeof obj.delete !== 'function' || typeof obj.get !== 'function' || typeof obj.getAll !== 'function' || typeof obj.has !== 'function' || typeof obj.set !== 'function') {
		return false;
	}

	// Brand-checking and more duck-typing as optional condition.
	return obj.constructor.name === 'URLSearchParams' || Object.prototype.toString.call(obj) === '[object URLSearchParams]' || typeof obj.sort === 'function';
}

/**
 * Check if `obj` is a W3C `Blob` object (which `File` inherits from)
 * @param  {*} obj
 * @return {boolean}
 */
function isBlob(obj) {
	return typeof obj === 'object' && typeof obj.arrayBuffer === 'function' && typeof obj.type === 'string' && typeof obj.stream === 'function' && typeof obj.constructor === 'function' && typeof obj.constructor.name === 'string' && /^(Blob|File)$/.test(obj.constructor.name) && /^(Blob|File)$/.test(obj[Symbol.toStringTag]);
}

/**
 * Clone body given Res/Req instance
 *
 * @param   Mixed  instance  Response or Request instance
 * @return  Mixed
 */
function clone(instance) {
	let p1, p2;
	let body = instance.body;

	// don't allow cloning a used body
	if (instance.bodyUsed) {
		throw new Error('cannot clone body after it is used');
	}

	// check that body is a stream and not form-data object
	// note: we can't clone the form-data object without having it as a dependency
	if (body instanceof Stream && typeof body.getBoundary !== 'function') {
		// tee instance body
		p1 = new PassThrough();
		p2 = new PassThrough();
		body.pipe(p1);
		body.pipe(p2);
		// set instance body to teed body and return the other teed body
		instance[INTERNALS].body = p1;
		body = p2;
	}

	return body;
}

/**
 * Performs the operation "extract a `Content-Type` value from |object|" as
 * specified in the specification:
 * https://fetch.spec.whatwg.org/#concept-bodyinit-extract
 *
 * This function assumes that instance.body is present.
 *
 * @param   Mixed  instance  Any options.body input
 */
function extractContentType(body) {
	if (body === null) {
		// body is null
		return null;
	} else if (typeof body === 'string') {
		// body is string
		return 'text/plain;charset=UTF-8';
	} else if (isURLSearchParams(body)) {
		// body is a URLSearchParams
		return 'application/x-www-form-urlencoded;charset=UTF-8';
	} else if (isBlob(body)) {
		// body is blob
		return body.type || null;
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		return null;
	} else if (Object.prototype.toString.call(body) === '[object ArrayBuffer]') {
		// body is ArrayBuffer
		return null;
	} else if (ArrayBuffer.isView(body)) {
		// body is ArrayBufferView
		return null;
	} else if (typeof body.getBoundary === 'function') {
		// detect form data input from form-data module
		return `multipart/form-data;boundary=${body.getBoundary()}`;
	} else if (body instanceof Stream) {
		// body is stream
		// can't really do much about this
		return null;
	} else {
		// Body constructor defaults other things to string
		return 'text/plain;charset=UTF-8';
	}
}

/**
 * The Fetch Standard treats this as if "total bytes" is a property on the body.
 * For us, we have to explicitly get it with a function.
 *
 * ref: https://fetch.spec.whatwg.org/#concept-body-total-bytes
 *
 * @param   Body    instance   Instance of Body
 * @return  Number?            Number of bytes, or null if not possible
 */
function getTotalBytes(instance) {
	const body = instance.body;


	if (body === null) {
		// body is null
		return 0;
	} else if (isBlob(body)) {
		return body.size;
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		return body.length;
	} else if (body && typeof body.getLengthSync === 'function') {
		// detect form data input from form-data module
		if (body._lengthRetrievers && body._lengthRetrievers.length == 0 || // 1.x
		body.hasKnownLength && body.hasKnownLength()) {
			// 2.x
			return body.getLengthSync();
		}
		return null;
	} else {
		// body is stream
		return null;
	}
}

/**
 * Write a Body to a Node.js WritableStream (e.g. http.Request) object.
 *
 * @param   Body    instance   Instance of Body
 * @return  Void
 */
function writeToStream(dest, instance) {
	const body = instance.body;


	if (body === null) {
		// body is null
		dest.end();
	} else if (isBlob(body)) {
		body.stream().pipe(dest);
	} else if (Buffer.isBuffer(body)) {
		// body is buffer
		dest.write(body);
		dest.end();
	} else {
		// body is stream
		body.pipe(dest);
	}
}

// expose Promise
Body.Promise = global.Promise;

/**
 * headers.js
 *
 * Headers class offers convenient helpers
 */

const invalidTokenRegex = /[^\^_`a-zA-Z\-0-9!#$%&'*+.|~]/;
const invalidHeaderCharRegex = /[^\t\x20-\x7e\x80-\xff]/;

function validateName(name) {
	name = `${name}`;
	if (invalidTokenRegex.test(name) || name === '') {
		throw new TypeError(`${name} is not a legal HTTP header name`);
	}
}

function validateValue(value) {
	value = `${value}`;
	if (invalidHeaderCharRegex.test(value)) {
		throw new TypeError(`${value} is not a legal HTTP header value`);
	}
}

/**
 * Find the key in the map object given a header name.
 *
 * Returns undefined if not found.
 *
 * @param   String  name  Header name
 * @return  String|Undefined
 */
function find(map, name) {
	name = name.toLowerCase();
	for (const key in map) {
		if (key.toLowerCase() === name) {
			return key;
		}
	}
	return undefined;
}

const MAP = Symbol('map');
class Headers {
	/**
  * Headers class
  *
  * @param   Object  headers  Response headers
  * @return  Void
  */
	constructor() {
		let init = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : undefined;

		this[MAP] = Object.create(null);

		if (init instanceof Headers) {
			const rawHeaders = init.raw();
			const headerNames = Object.keys(rawHeaders);

			for (const headerName of headerNames) {
				for (const value of rawHeaders[headerName]) {
					this.append(headerName, value);
				}
			}

			return;
		}

		// We don't worry about converting prop to ByteString here as append()
		// will handle it.
		if (init == null) ; else if (typeof init === 'object') {
			const method = init[Symbol.iterator];
			if (method != null) {
				if (typeof method !== 'function') {
					throw new TypeError('Header pairs must be iterable');
				}

				// sequence<sequence<ByteString>>
				// Note: per spec we have to first exhaust the lists then process them
				const pairs = [];
				for (const pair of init) {
					if (typeof pair !== 'object' || typeof pair[Symbol.iterator] !== 'function') {
						throw new TypeError('Each header pair must be iterable');
					}
					pairs.push(Array.from(pair));
				}

				for (const pair of pairs) {
					if (pair.length !== 2) {
						throw new TypeError('Each header pair must be a name/value tuple');
					}
					this.append(pair[0], pair[1]);
				}
			} else {
				// record<ByteString, ByteString>
				for (const key of Object.keys(init)) {
					const value = init[key];
					this.append(key, value);
				}
			}
		} else {
			throw new TypeError('Provided initializer must be an object');
		}
	}

	/**
  * Return combined header value given name
  *
  * @param   String  name  Header name
  * @return  Mixed
  */
	get(name) {
		name = `${name}`;
		validateName(name);
		const key = find(this[MAP], name);
		if (key === undefined) {
			return null;
		}

		return this[MAP][key].join(', ');
	}

	/**
  * Iterate over all headers
  *
  * @param   Function  callback  Executed for each item with parameters (value, name, thisArg)
  * @param   Boolean   thisArg   `this` context for callback function
  * @return  Void
  */
	forEach(callback) {
		let thisArg = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

		let pairs = getHeaders(this);
		let i = 0;
		while (i < pairs.length) {
			var _pairs$i = pairs[i];
			const name = _pairs$i[0],
			      value = _pairs$i[1];

			callback.call(thisArg, value, name, this);
			pairs = getHeaders(this);
			i++;
		}
	}

	/**
  * Overwrite header values given name
  *
  * @param   String  name   Header name
  * @param   String  value  Header value
  * @return  Void
  */
	set(name, value) {
		name = `${name}`;
		value = `${value}`;
		validateName(name);
		validateValue(value);
		const key = find(this[MAP], name);
		this[MAP][key !== undefined ? key : name] = [value];
	}

	/**
  * Append a value onto existing header
  *
  * @param   String  name   Header name
  * @param   String  value  Header value
  * @return  Void
  */
	append(name, value) {
		name = `${name}`;
		value = `${value}`;
		validateName(name);
		validateValue(value);
		const key = find(this[MAP], name);
		if (key !== undefined) {
			this[MAP][key].push(value);
		} else {
			this[MAP][name] = [value];
		}
	}

	/**
  * Check for header name existence
  *
  * @param   String   name  Header name
  * @return  Boolean
  */
	has(name) {
		name = `${name}`;
		validateName(name);
		return find(this[MAP], name) !== undefined;
	}

	/**
  * Delete all header values given name
  *
  * @param   String  name  Header name
  * @return  Void
  */
	delete(name) {
		name = `${name}`;
		validateName(name);
		const key = find(this[MAP], name);
		if (key !== undefined) {
			delete this[MAP][key];
		}
	}

	/**
  * Return raw headers (non-spec api)
  *
  * @return  Object
  */
	raw() {
		return this[MAP];
	}

	/**
  * Get an iterator on keys.
  *
  * @return  Iterator
  */
	keys() {
		return createHeadersIterator(this, 'key');
	}

	/**
  * Get an iterator on values.
  *
  * @return  Iterator
  */
	values() {
		return createHeadersIterator(this, 'value');
	}

	/**
  * Get an iterator on entries.
  *
  * This is the default iterator of the Headers object.
  *
  * @return  Iterator
  */
	[Symbol.iterator]() {
		return createHeadersIterator(this, 'key+value');
	}
}
Headers.prototype.entries = Headers.prototype[Symbol.iterator];

Object.defineProperty(Headers.prototype, Symbol.toStringTag, {
	value: 'Headers',
	writable: false,
	enumerable: false,
	configurable: true
});

Object.defineProperties(Headers.prototype, {
	get: { enumerable: true },
	forEach: { enumerable: true },
	set: { enumerable: true },
	append: { enumerable: true },
	has: { enumerable: true },
	delete: { enumerable: true },
	keys: { enumerable: true },
	values: { enumerable: true },
	entries: { enumerable: true }
});

function getHeaders(headers) {
	let kind = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'key+value';

	const keys = Object.keys(headers[MAP]).sort();
	return keys.map(kind === 'key' ? function (k) {
		return k.toLowerCase();
	} : kind === 'value' ? function (k) {
		return headers[MAP][k].join(', ');
	} : function (k) {
		return [k.toLowerCase(), headers[MAP][k].join(', ')];
	});
}

const INTERNAL = Symbol('internal');

function createHeadersIterator(target, kind) {
	const iterator = Object.create(HeadersIteratorPrototype);
	iterator[INTERNAL] = {
		target,
		kind,
		index: 0
	};
	return iterator;
}

const HeadersIteratorPrototype = Object.setPrototypeOf({
	next() {
		// istanbul ignore if
		if (!this || Object.getPrototypeOf(this) !== HeadersIteratorPrototype) {
			throw new TypeError('Value of `this` is not a HeadersIterator');
		}

		var _INTERNAL = this[INTERNAL];
		const target = _INTERNAL.target,
		      kind = _INTERNAL.kind,
		      index = _INTERNAL.index;

		const values = getHeaders(target, kind);
		const len = values.length;
		if (index >= len) {
			return {
				value: undefined,
				done: true
			};
		}

		this[INTERNAL].index = index + 1;

		return {
			value: values[index],
			done: false
		};
	}
}, Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())));

Object.defineProperty(HeadersIteratorPrototype, Symbol.toStringTag, {
	value: 'HeadersIterator',
	writable: false,
	enumerable: false,
	configurable: true
});

/**
 * Export the Headers object in a form that Node.js can consume.
 *
 * @param   Headers  headers
 * @return  Object
 */
function exportNodeCompatibleHeaders(headers) {
	const obj = Object.assign({ __proto__: null }, headers[MAP]);

	// http.request() only supports string as Host header. This hack makes
	// specifying custom Host header possible.
	const hostHeaderKey = find(headers[MAP], 'Host');
	if (hostHeaderKey !== undefined) {
		obj[hostHeaderKey] = obj[hostHeaderKey][0];
	}

	return obj;
}

/**
 * Create a Headers object from an object of headers, ignoring those that do
 * not conform to HTTP grammar productions.
 *
 * @param   Object  obj  Object of headers
 * @return  Headers
 */
function createHeadersLenient(obj) {
	const headers = new Headers();
	for (const name of Object.keys(obj)) {
		if (invalidTokenRegex.test(name)) {
			continue;
		}
		if (Array.isArray(obj[name])) {
			for (const val of obj[name]) {
				if (invalidHeaderCharRegex.test(val)) {
					continue;
				}
				if (headers[MAP][name] === undefined) {
					headers[MAP][name] = [val];
				} else {
					headers[MAP][name].push(val);
				}
			}
		} else if (!invalidHeaderCharRegex.test(obj[name])) {
			headers[MAP][name] = [obj[name]];
		}
	}
	return headers;
}

const INTERNALS$1 = Symbol('Response internals');

// fix an issue where "STATUS_CODES" aren't a named export for node <10
const STATUS_CODES = http.STATUS_CODES;

/**
 * Response class
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
class Response {
	constructor() {
		let body = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
		let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		Body.call(this, body, opts);

		const status = opts.status || 200;
		const headers = new Headers(opts.headers);

		if (body != null && !headers.has('Content-Type')) {
			const contentType = extractContentType(body);
			if (contentType) {
				headers.append('Content-Type', contentType);
			}
		}

		this[INTERNALS$1] = {
			url: opts.url,
			status,
			statusText: opts.statusText || STATUS_CODES[status],
			headers,
			counter: opts.counter
		};
	}

	get url() {
		return this[INTERNALS$1].url || '';
	}

	get status() {
		return this[INTERNALS$1].status;
	}

	/**
  * Convenience property representing if the request ended normally
  */
	get ok() {
		return this[INTERNALS$1].status >= 200 && this[INTERNALS$1].status < 300;
	}

	get redirected() {
		return this[INTERNALS$1].counter > 0;
	}

	get statusText() {
		return this[INTERNALS$1].statusText;
	}

	get headers() {
		return this[INTERNALS$1].headers;
	}

	/**
  * Clone this response
  *
  * @return  Response
  */
	clone() {
		return new Response(clone(this), {
			url: this.url,
			status: this.status,
			statusText: this.statusText,
			headers: this.headers,
			ok: this.ok,
			redirected: this.redirected
		});
	}
}

Body.mixIn(Response.prototype);

Object.defineProperties(Response.prototype, {
	url: { enumerable: true },
	status: { enumerable: true },
	ok: { enumerable: true },
	redirected: { enumerable: true },
	statusText: { enumerable: true },
	headers: { enumerable: true },
	clone: { enumerable: true }
});

Object.defineProperty(Response.prototype, Symbol.toStringTag, {
	value: 'Response',
	writable: false,
	enumerable: false,
	configurable: true
});

const INTERNALS$2 = Symbol('Request internals');

// fix an issue where "format", "parse" aren't a named export for node <10
const parse_url = Url.parse;
const format_url = Url.format;

const streamDestructionSupported = 'destroy' in Stream.Readable.prototype;

/**
 * Check if a value is an instance of Request.
 *
 * @param   Mixed   input
 * @return  Boolean
 */
function isRequest(input) {
	return typeof input === 'object' && typeof input[INTERNALS$2] === 'object';
}

function isAbortSignal(signal) {
	const proto = signal && typeof signal === 'object' && Object.getPrototypeOf(signal);
	return !!(proto && proto.constructor.name === 'AbortSignal');
}

/**
 * Request class
 *
 * @param   Mixed   input  Url or Request instance
 * @param   Object  init   Custom options
 * @return  Void
 */
class Request {
	constructor(input) {
		let init = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

		let parsedURL;

		// normalize input
		if (!isRequest(input)) {
			if (input && input.href) {
				// in order to support Node.js' Url objects; though WHATWG's URL objects
				// will fall into this branch also (since their `toString()` will return
				// `href` property anyway)
				parsedURL = parse_url(input.href);
			} else {
				// coerce input to a string before attempting to parse
				parsedURL = parse_url(`${input}`);
			}
			input = {};
		} else {
			parsedURL = parse_url(input.url);
		}

		let method = init.method || input.method || 'GET';
		method = method.toUpperCase();

		if ((init.body != null || isRequest(input) && input.body !== null) && (method === 'GET' || method === 'HEAD')) {
			throw new TypeError('Request with GET/HEAD method cannot have body');
		}

		let inputBody = init.body != null ? init.body : isRequest(input) && input.body !== null ? clone(input) : null;

		Body.call(this, inputBody, {
			timeout: init.timeout || input.timeout || 0,
			size: init.size || input.size || 0
		});

		const headers = new Headers(init.headers || input.headers || {});

		if (inputBody != null && !headers.has('Content-Type')) {
			const contentType = extractContentType(inputBody);
			if (contentType) {
				headers.append('Content-Type', contentType);
			}
		}

		let signal = isRequest(input) ? input.signal : null;
		if ('signal' in init) signal = init.signal;

		if (signal != null && !isAbortSignal(signal)) {
			throw new TypeError('Expected signal to be an instanceof AbortSignal');
		}

		this[INTERNALS$2] = {
			method,
			redirect: init.redirect || input.redirect || 'follow',
			headers,
			parsedURL,
			signal
		};

		// node-fetch-only options
		this.follow = init.follow !== undefined ? init.follow : input.follow !== undefined ? input.follow : 20;
		this.compress = init.compress !== undefined ? init.compress : input.compress !== undefined ? input.compress : true;
		this.counter = init.counter || input.counter || 0;
		this.agent = init.agent || input.agent;
	}

	get method() {
		return this[INTERNALS$2].method;
	}

	get url() {
		return format_url(this[INTERNALS$2].parsedURL);
	}

	get headers() {
		return this[INTERNALS$2].headers;
	}

	get redirect() {
		return this[INTERNALS$2].redirect;
	}

	get signal() {
		return this[INTERNALS$2].signal;
	}

	/**
  * Clone this request
  *
  * @return  Request
  */
	clone() {
		return new Request(this);
	}
}

Body.mixIn(Request.prototype);

Object.defineProperty(Request.prototype, Symbol.toStringTag, {
	value: 'Request',
	writable: false,
	enumerable: false,
	configurable: true
});

Object.defineProperties(Request.prototype, {
	method: { enumerable: true },
	url: { enumerable: true },
	headers: { enumerable: true },
	redirect: { enumerable: true },
	clone: { enumerable: true },
	signal: { enumerable: true }
});

/**
 * Convert a Request to Node.js http request options.
 *
 * @param   Request  A Request instance
 * @return  Object   The options object to be passed to http.request
 */
function getNodeRequestOptions(request) {
	const parsedURL = request[INTERNALS$2].parsedURL;
	const headers = new Headers(request[INTERNALS$2].headers);

	// fetch step 1.3
	if (!headers.has('Accept')) {
		headers.set('Accept', '*/*');
	}

	// Basic fetch
	if (!parsedURL.protocol || !parsedURL.hostname) {
		throw new TypeError('Only absolute URLs are supported');
	}

	if (!/^https?:$/.test(parsedURL.protocol)) {
		throw new TypeError('Only HTTP(S) protocols are supported');
	}

	if (request.signal && request.body instanceof Stream.Readable && !streamDestructionSupported) {
		throw new Error('Cancellation of streamed requests with AbortSignal is not supported in node < 8');
	}

	// HTTP-network-or-cache fetch steps 2.4-2.7
	let contentLengthValue = null;
	if (request.body == null && /^(POST|PUT)$/i.test(request.method)) {
		contentLengthValue = '0';
	}
	if (request.body != null) {
		const totalBytes = getTotalBytes(request);
		if (typeof totalBytes === 'number') {
			contentLengthValue = String(totalBytes);
		}
	}
	if (contentLengthValue) {
		headers.set('Content-Length', contentLengthValue);
	}

	// HTTP-network-or-cache fetch step 2.11
	if (!headers.has('User-Agent')) {
		headers.set('User-Agent', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)');
	}

	// HTTP-network-or-cache fetch step 2.15
	if (request.compress && !headers.has('Accept-Encoding')) {
		headers.set('Accept-Encoding', 'gzip,deflate');
	}

	let agent = request.agent;
	if (typeof agent === 'function') {
		agent = agent(parsedURL);
	}

	if (!headers.has('Connection') && !agent) {
		headers.set('Connection', 'close');
	}

	// HTTP-network fetch step 4.2
	// chunked encoding is handled by Node.js

	return Object.assign({}, parsedURL, {
		method: request.method,
		headers: exportNodeCompatibleHeaders(headers),
		agent
	});
}

/**
 * abort-error.js
 *
 * AbortError interface for cancelled requests
 */

/**
 * Create AbortError instance
 *
 * @param   String      message      Error message for human
 * @return  AbortError
 */
function AbortError(message) {
  Error.call(this, message);

  this.type = 'aborted';
  this.message = message;

  // hide custom error implementation details from end-users
  Error.captureStackTrace(this, this.constructor);
}

AbortError.prototype = Object.create(Error.prototype);
AbortError.prototype.constructor = AbortError;
AbortError.prototype.name = 'AbortError';

// fix an issue where "PassThrough", "resolve" aren't a named export for node <10
const PassThrough$1 = Stream.PassThrough;
const resolve_url = Url.resolve;

/**
 * Fetch function
 *
 * @param   Mixed    url   Absolute url or Request instance
 * @param   Object   opts  Fetch options
 * @return  Promise
 */
function fetch(url, opts) {

	// allow custom promise
	if (!fetch.Promise) {
		throw new Error('native promise missing, set fetch.Promise to your favorite alternative');
	}

	Body.Promise = fetch.Promise;

	// wrap http.request into fetch
	return new fetch.Promise(function (resolve, reject) {
		// build request object
		const request = new Request(url, opts);
		const options = getNodeRequestOptions(request);

		const send = (options.protocol === 'https:' ? https : http).request;
		const signal = request.signal;

		let response = null;

		const abort = function abort() {
			let error = new AbortError('The user aborted a request.');
			reject(error);
			if (request.body && request.body instanceof Stream.Readable) {
				request.body.destroy(error);
			}
			if (!response || !response.body) return;
			response.body.emit('error', error);
		};

		if (signal && signal.aborted) {
			abort();
			return;
		}

		const abortAndFinalize = function abortAndFinalize() {
			abort();
			finalize();
		};

		// send request
		const req = send(options);
		let reqTimeout;

		if (signal) {
			signal.addEventListener('abort', abortAndFinalize);
		}

		function finalize() {
			req.abort();
			if (signal) signal.removeEventListener('abort', abortAndFinalize);
			clearTimeout(reqTimeout);
		}

		if (request.timeout) {
			req.once('socket', function (socket) {
				reqTimeout = setTimeout(function () {
					reject(new FetchError(`network timeout at: ${request.url}`, 'request-timeout'));
					finalize();
				}, request.timeout);
			});
		}

		req.on('error', function (err) {
			reject(new FetchError(`request to ${request.url} failed, reason: ${err.message}`, 'system', err));
			finalize();
		});

		req.on('response', function (res) {
			clearTimeout(reqTimeout);

			const headers = createHeadersLenient(res.headers);

			// HTTP fetch step 5
			if (fetch.isRedirect(res.statusCode)) {
				// HTTP fetch step 5.2
				const location = headers.get('Location');

				// HTTP fetch step 5.3
				const locationURL = location === null ? null : resolve_url(request.url, location);

				// HTTP fetch step 5.5
				switch (request.redirect) {
					case 'error':
						reject(new FetchError(`redirect mode is set to error: ${request.url}`, 'no-redirect'));
						finalize();
						return;
					case 'manual':
						// node-fetch-specific step: make manual redirect a bit easier to use by setting the Location header value to the resolved URL.
						if (locationURL !== null) {
							// handle corrupted header
							try {
								headers.set('Location', locationURL);
							} catch (err) {
								// istanbul ignore next: nodejs server prevent invalid response headers, we can't test this through normal request
								reject(err);
							}
						}
						break;
					case 'follow':
						// HTTP-redirect fetch step 2
						if (locationURL === null) {
							break;
						}

						// HTTP-redirect fetch step 5
						if (request.counter >= request.follow) {
							reject(new FetchError(`maximum redirect reached at: ${request.url}`, 'max-redirect'));
							finalize();
							return;
						}

						// HTTP-redirect fetch step 6 (counter increment)
						// Create a new Request object.
						const requestOpts = {
							headers: new Headers(request.headers),
							follow: request.follow,
							counter: request.counter + 1,
							agent: request.agent,
							compress: request.compress,
							method: request.method,
							body: request.body,
							signal: request.signal,
							timeout: request.timeout
						};

						// HTTP-redirect fetch step 9
						if (res.statusCode !== 303 && request.body && getTotalBytes(request) === null) {
							reject(new FetchError('Cannot follow redirect with body being a readable stream', 'unsupported-redirect'));
							finalize();
							return;
						}

						// HTTP-redirect fetch step 11
						if (res.statusCode === 303 || (res.statusCode === 301 || res.statusCode === 302) && request.method === 'POST') {
							requestOpts.method = 'GET';
							requestOpts.body = undefined;
							requestOpts.headers.delete('content-length');
						}

						// HTTP-redirect fetch step 15
						resolve(fetch(new Request(locationURL, requestOpts)));
						finalize();
						return;
				}
			}

			// prepare response
			res.once('end', function () {
				if (signal) signal.removeEventListener('abort', abortAndFinalize);
			});
			let body = res.pipe(new PassThrough$1());

			const response_options = {
				url: request.url,
				status: res.statusCode,
				statusText: res.statusMessage,
				headers: headers,
				size: request.size,
				timeout: request.timeout,
				counter: request.counter
			};

			// HTTP-network fetch step 12.1.1.3
			const codings = headers.get('Content-Encoding');

			// HTTP-network fetch step 12.1.1.4: handle content codings

			// in following scenarios we ignore compression support
			// 1. compression support is disabled
			// 2. HEAD request
			// 3. no Content-Encoding header
			// 4. no content response (204)
			// 5. content not modified response (304)
			if (!request.compress || request.method === 'HEAD' || codings === null || res.statusCode === 204 || res.statusCode === 304) {
				response = new Response(body, response_options);
				resolve(response);
				return;
			}

			// For Node v6+
			// Be less strict when decoding compressed responses, since sometimes
			// servers send slightly invalid responses that are still accepted
			// by common browsers.
			// Always using Z_SYNC_FLUSH is what cURL does.
			const zlibOptions = {
				flush: zlib.Z_SYNC_FLUSH,
				finishFlush: zlib.Z_SYNC_FLUSH
			};

			// for gzip
			if (codings == 'gzip' || codings == 'x-gzip') {
				body = body.pipe(zlib.createGunzip(zlibOptions));
				response = new Response(body, response_options);
				resolve(response);
				return;
			}

			// for deflate
			if (codings == 'deflate' || codings == 'x-deflate') {
				// handle the infamous raw deflate response from old servers
				// a hack for old IIS and Apache servers
				const raw = res.pipe(new PassThrough$1());
				raw.once('data', function (chunk) {
					// see http://stackoverflow.com/questions/37519828
					if ((chunk[0] & 0x0F) === 0x08) {
						body = body.pipe(zlib.createInflate());
					} else {
						body = body.pipe(zlib.createInflateRaw());
					}
					response = new Response(body, response_options);
					resolve(response);
				});
				return;
			}

			// for br
			if (codings == 'br' && typeof zlib.createBrotliDecompress === 'function') {
				body = body.pipe(zlib.createBrotliDecompress());
				response = new Response(body, response_options);
				resolve(response);
				return;
			}

			// otherwise, use response as-is
			response = new Response(body, response_options);
			resolve(response);
		});

		writeToStream(req, request);
	});
}
/**
 * Redirect code matching
 *
 * @param   Number   code  Status code
 * @return  Boolean
 */
fetch.isRedirect = function (code) {
	return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
};

// expose Promise
fetch.Promise = global.Promise;

function get_page_handler(
	manifest,
	session_getter
) {
	const get_build_info =  (assets => () => assets)(JSON.parse(fs.readFileSync(path.join(build_dir, 'build.json'), 'utf-8')));

	const template =  (str => () => str)(read_template(build_dir));

	const has_service_worker = fs.existsSync(path.join(build_dir, 'service-worker.js'));

	const { server_routes, pages } = manifest;
	const error_route = manifest.error;

	function bail(req, res, err) {
		console.error(err);

		const message =  'Internal server error';

		res.statusCode = 500;
		res.end(`<pre>${message}</pre>`);
	}

	function handle_error(req, res, statusCode, error) {
		handle_page({
			pattern: null,
			parts: [
				{ name: null, component: error_route }
			]
		}, req, res, statusCode, error || new Error('Unknown error in preload function'));
	}

	async function handle_page(page, req, res, status = 200, error = null) {
		const is_service_worker_index = req.path === '/service-worker-index.html';
		const build_info




 = get_build_info();

		res.setHeader('Content-Type', 'text/html');
		res.setHeader('Cache-Control',  'max-age=600');

		// preload main.js and current route
		// TODO detect other stuff we can preload? images, CSS, fonts?
		let preloaded_chunks = Array.isArray(build_info.assets.main) ? build_info.assets.main : [build_info.assets.main];
		if (!error && !is_service_worker_index) {
			page.parts.forEach(part => {
				if (!part) return;

				// using concat because it could be a string or an array. thanks webpack!
				preloaded_chunks = preloaded_chunks.concat(build_info.assets[part.name]);
			});
		}

		if (build_info.bundler === 'rollup') {
			// TODO add dependencies and CSS
			const link = preloaded_chunks
				.filter(file => file && !file.match(/\.map$/))
				.map(file => `<${req.baseUrl}/client/${file}>;rel="modulepreload"`)
				.join(', ');

			res.setHeader('Link', link);
		} else {
			const link = preloaded_chunks
				.filter(file => file && !file.match(/\.map$/))
				.map((file) => {
					const as = /\.css$/.test(file) ? 'style' : 'script';
					return `<${req.baseUrl}/client/${file}>;rel="preload";as="${as}"`;
				})
				.join(', ');

			res.setHeader('Link', link);
		}

		const session = session_getter(req, res);

		let redirect;
		let preload_error;

		const preload_context = {
			redirect: (statusCode, location) => {
				if (redirect && (redirect.statusCode !== statusCode || redirect.location !== location)) {
					throw new Error(`Conflicting redirects`);
				}
				location = location.replace(/^\//g, ''); // leading slash (only)
				redirect = { statusCode, location };
			},
			error: (statusCode, message) => {
				preload_error = { statusCode, message };
			},
			fetch: (url, opts) => {
				const parsed = new Url.URL(url, `http://127.0.0.1:${process.env.PORT}${req.baseUrl ? req.baseUrl + '/' :''}`);

				if (opts) {
					opts = Object.assign({}, opts);

					const include_cookies = (
						opts.credentials === 'include' ||
						opts.credentials === 'same-origin' && parsed.origin === `http://127.0.0.1:${process.env.PORT}`
					);

					if (include_cookies) {
						opts.headers = Object.assign({}, opts.headers);

						const cookies = Object.assign(
							{},
							cookie.parse(req.headers.cookie || ''),
							cookie.parse(opts.headers.cookie || '')
						);

						const set_cookie = res.getHeader('Set-Cookie');
						(Array.isArray(set_cookie) ? set_cookie : [set_cookie]).forEach(str => {
							const match = /([^=]+)=([^;]+)/.exec(str);
							if (match) cookies[match[1]] = match[2];
						});

						const str = Object.keys(cookies)
							.map(key => `${key}=${cookies[key]}`)
							.join('; ');

						opts.headers.cookie = str;
					}
				}

				return fetch(parsed.href, opts);
			}
		};

		let preloaded;
		let match;
		let params;

		try {
			const root_preloaded = manifest.root_preload
				? manifest.root_preload.call(preload_context, {
					host: req.headers.host,
					path: req.path,
					query: req.query,
					params: {}
				}, session)
				: {};

			match = error ? null : page.pattern.exec(req.path);


			let toPreload = [root_preloaded];
			if (!is_service_worker_index) {
				toPreload = toPreload.concat(page.parts.map(part => {
					if (!part) return null;

					// the deepest level is used below, to initialise the store
					params = part.params ? part.params(match) : {};

					return part.preload
						? part.preload.call(preload_context, {
							host: req.headers.host,
							path: req.path,
							query: req.query,
							params
						}, session)
						: {};
				}));
			}

			preloaded = await Promise.all(toPreload);
		} catch (err) {
			if (error) {
				return bail(req, res, err)
			}

			preload_error = { statusCode: 500, message: err };
			preloaded = []; // appease TypeScript
		}

		try {
			if (redirect) {
				const location = Url.resolve((req.baseUrl || '') + '/', redirect.location);

				res.statusCode = redirect.statusCode;
				res.setHeader('Location', location);
				res.end();

				return;
			}

			if (preload_error) {
				handle_error(req, res, preload_error.statusCode, preload_error.message);
				return;
			}

			const segments = req.path.split('/').filter(Boolean);

			// TODO make this less confusing
			const layout_segments = [segments[0]];
			let l = 1;

			page.parts.forEach((part, i) => {
				layout_segments[l] = segments[i + 1];
				if (!part) return null;
				l++;
			});

			const props = {
				stores: {
					page: {
						subscribe: writable({
							host: req.headers.host,
							path: req.path,
							query: req.query,
							params
						}).subscribe
					},
					preloading: {
						subscribe: writable(null).subscribe
					},
					session: writable(session)
				},
				segments: layout_segments,
				status: error ? status : 200,
				error: error ? error instanceof Error ? error : { message: error } : null,
				level0: {
					props: preloaded[0]
				},
				level1: {
					segment: segments[0],
					props: {}
				}
			};

			if (!is_service_worker_index) {
				let l = 1;
				for (let i = 0; i < page.parts.length; i += 1) {
					const part = page.parts[i];
					if (!part) continue;

					props[`level${l++}`] = {
						component: part.component,
						props: preloaded[i + 1] || {},
						segment: segments[i]
					};
				}
			}

			const { html, head, css } = App.render(props);

			const serialized = {
				preloaded: `[${preloaded.map(data => try_serialize(data)).join(',')}]`,
				session: session && try_serialize(session, err => {
					throw new Error(`Failed to serialize session data: ${err.message}`);
				}),
				error: error && try_serialize(props.error)
			};

			let script = `__SAPPER__={${[
				error && `error:${serialized.error},status:${status}`,
				`baseUrl:"${req.baseUrl}"`,
				serialized.preloaded && `preloaded:${serialized.preloaded}`,
				serialized.session && `session:${serialized.session}`
			].filter(Boolean).join(',')}};`;

			if (has_service_worker) {
				script += `if('serviceWorker' in navigator)navigator.serviceWorker.register('${req.baseUrl}/service-worker.js');`;
			}

			const file = [].concat(build_info.assets.main).filter(file => file && /\.js$/.test(file))[0];
			const main = `${req.baseUrl}/client/${file}`;

			if (build_info.bundler === 'rollup') {
				if (build_info.legacy_assets) {
					const legacy_main = `${req.baseUrl}/client/legacy/${build_info.legacy_assets.main}`;
					script += `(function(){try{eval("async function x(){}");var main="${main}"}catch(e){main="${legacy_main}"};var s=document.createElement("script");try{new Function("if(0)import('')")();s.src=main;s.type="module";s.crossOrigin="use-credentials";}catch(e){s.src="${req.baseUrl}/client/shimport@${build_info.shimport}.js";s.setAttribute("data-main",main);}document.head.appendChild(s);}());`;
				} else {
					script += `var s=document.createElement("script");try{new Function("if(0)import('')")();s.src="${main}";s.type="module";s.crossOrigin="use-credentials";}catch(e){s.src="${req.baseUrl}/client/shimport@${build_info.shimport}.js";s.setAttribute("data-main","${main}")}document.head.appendChild(s)`;
				}
			} else {
				script += `</script><script src="${main}">`;
			}

			let styles;

			// TODO make this consistent across apps
			// TODO embed build_info in placeholder.ts
			if (build_info.css && build_info.css.main) {
				const css_chunks = new Set();
				if (build_info.css.main) css_chunks.add(build_info.css.main);
				page.parts.forEach(part => {
					if (!part) return;
					const css_chunks_for_part = build_info.css.chunks[part.file];

					if (css_chunks_for_part) {
						css_chunks_for_part.forEach(file => {
							css_chunks.add(file);
						});
					}
				});

				styles = Array.from(css_chunks)
					.map(href => `<link rel="stylesheet" href="client/${href}">`)
					.join('');
			} else {
				styles = (css && css.code ? `<style>${css.code}</style>` : '');
			}

			// users can set a CSP nonce using res.locals.nonce
			const nonce_attr = (res.locals && res.locals.nonce) ? ` nonce="${res.locals.nonce}"` : '';

			const body = template()
				.replace('%sapper.base%', () => `<base href="${req.baseUrl}/">`)
				.replace('%sapper.scripts%', () => `<script${nonce_attr}>${script}</script>`)
				.replace('%sapper.html%', () => html)
				.replace('%sapper.head%', () => `<noscript id='sapper-head-start'></noscript>${head}<noscript id='sapper-head-end'></noscript>`)
				.replace('%sapper.styles%', () => styles);

			res.statusCode = status;
			res.end(body);
		} catch(err) {
			if (error) {
				bail(req, res, err);
			} else {
				handle_error(req, res, 500, err);
			}
		}
	}

	return function find_route(req, res, next) {
		if (req.path === '/service-worker-index.html') {
			const homePage = pages.find(page => page.pattern.test('/'));
			handle_page(homePage, req, res);
			return;
		}

		for (const page of pages) {
			if (page.pattern.test(req.path)) {
				handle_page(page, req, res);
				return;
			}
		}

		handle_error(req, res, 404, 'Not found');
	};
}

function read_template(dir = build_dir) {
	return fs.readFileSync(`${dir}/template.html`, 'utf-8');
}

function try_serialize(data, fail) {
	try {
		return devalue(data);
	} catch (err) {
		if (fail) fail(err);
		return null;
	}
}

function middleware(opts


 = {}) {
	const { session, ignore } = opts;

	let emitted_basepath = false;

	return compose_handlers(ignore, [
		(req, res, next) => {
			if (req.baseUrl === undefined) {
				let { originalUrl } = req;
				if (req.url === '/' && originalUrl[originalUrl.length - 1] !== '/') {
					originalUrl += '/';
				}

				req.baseUrl = originalUrl
					? originalUrl.slice(0, -req.url.length)
					: '';
			}

			if (!emitted_basepath && process.send) {
				process.send({
					__sapper__: true,
					event: 'basepath',
					basepath: req.baseUrl
				});

				emitted_basepath = true;
			}

			if (req.path === undefined) {
				req.path = req.url.replace(/\?.*/, '');
			}

			next();
		},

		fs.existsSync(path.join(build_dir, 'service-worker.js')) && serve({
			pathname: '/service-worker.js',
			cache_control: 'no-cache, no-store, must-revalidate'
		}),

		fs.existsSync(path.join(build_dir, 'service-worker.js.map')) && serve({
			pathname: '/service-worker.js.map',
			cache_control: 'no-cache, no-store, must-revalidate'
		}),

		serve({
			prefix: '/client/',
			cache_control:  'max-age=31536000, immutable'
		}),

		get_server_route_handler(manifest.server_routes),

		get_page_handler(manifest, session || noop$1)
	].filter(Boolean));
}

function compose_handlers(ignore, handlers) {
	const total = handlers.length;

	function nth_handler(n, req, res, next) {
		if (n >= total) {
			return next();
		}

		handlers[n](req, res, () => nth_handler(n+1, req, res, next));
	}

	return !ignore
		? (req, res, next) => nth_handler(0, req, res, next)
		: (req, res, next) => {
			if (should_ignore(req.path, ignore)) {
				next();
			} else {
				nth_handler(0, req, res, next);
			}
		};
}

function should_ignore(uri, val) {
	if (Array.isArray(val)) return val.some(x => should_ignore(uri, x));
	if (val instanceof RegExp) return val.test(uri);
	if (typeof val === 'function') return val(uri);
	return uri.startsWith(val.charCodeAt(0) === 47 ? val : `/${val}`);
}

function serve({ prefix, pathname, cache_control }



) {
	const filter = pathname
		? (req) => req.path === pathname
		: (req) => req.path.startsWith(prefix);

	const cache = new Map();

	const read =  (file) => (cache.has(file) ? cache : cache.set(file, fs.readFileSync(path.join(build_dir, file)))).get(file);

	return (req, res, next) => {
		if (filter(req)) {
			const type = lite.getType(req.path);

			try {
				const file = path.posix.normalize(decodeURIComponent(req.path));
				const data = read(file);

				res.setHeader('Content-Type', type);
				res.setHeader('Cache-Control', cache_control);
				res.end(data);
			} catch (err) {
				res.statusCode = 404;
				res.end('not found');
			}
		} else {
			next();
		}
	};
}

function noop$1(){}

const { PORT, NODE_ENV } = process.env;
const dev = NODE_ENV === 'development';

polka() // You can also use Express
	.use(
		compression({ threshold: 0 }),
		sirv('static', { dev }),
		middleware()
	)
	.listen(PORT, err => {
		if (err) console.log('error', err);
	});
