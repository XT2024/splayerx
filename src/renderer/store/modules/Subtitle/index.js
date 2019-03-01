import Vue from 'vue';
import pick from 'lodash/pick';
import partialRight from 'lodash/partialRight';
import uniq from 'lodash/uniq';
import difference from 'lodash/difference';
import remove from 'lodash/remove';
import { Subtitle as subtitleMutations } from '@/store/mutationTypes';
import { Subtitle as subtitleActions } from '@/store/actionTypes';
import { metaInfoUpdate } from './rank';

const state = {
  loadingStates: {},
  durations: {},
  names: {},
  languages: {},
  formats: {},
  types: {},
  ranks: {},
  currentSubtitleId: '',
  videoSubtitleMap: {},
  chosenStyle: '',
  chosenSize: 1,
  subtitleDelay: 0,
  scaleNum: 1,
  calculatedNoSub: true,
  subToTop: false,
};

const getters = {
  currentSubtitleId: state => state.currentSubtitleId,
  allSubtitleList: ({
    loadingStates, names, languages, formats, ranks, types,
  }) => (
    Object.keys(loadingStates)
      .map(id => ({
        id,
        name: names[id],
        language: languages[id],
        format: formats[id],
        rank: ranks[id],
        loading: loadingStates[id],
        type: types[id],
      }))
  ),
  subtitleList: ({ videoSubtitleMap }, { originSrc, allSubtitleList }) =>
    (videoSubtitleMap[originSrc] || [])
      .map(subtitleId => allSubtitleList.find(({ id }) => id === subtitleId))
      .sort((a, b) => b.rank - a.rank),
  getVideoSrcById: ({ videoSubtitleMap }) => id =>
    (Object.keys(videoSubtitleMap).find(videoSrc => videoSubtitleMap[videoSrc].includes(id))),
  subtitleDelay: state => state.subtitleDelay,
  chosenStyle: state => state.chosenStyle,
  chosenSize: state => state.chosenSize,
  scaleNum: state => state.scaleNum,
  calculatedNoSub: state => state.calculatedNoSub,
  subToTop: state => state.subToTop,
};

const mutations = {
  [subtitleMutations.RESET_SUBTITLES](state, resetFields) {
    if (!resetFields) {
      Vue.set(state, 'loadingStates', {});
      Vue.set(state, 'durations', {});
      Vue.set(state, 'names', {});
      Vue.set(state, 'languages', {});
      Vue.set(state, 'formats', {});
    } else {
      const supportedFields = ['loadingStates', 'durations', 'names', 'languages', 'formats', 'types'];
      const changingFields = Object.keys(resetFields)
        .filter(field => supportedFields.includes(field));
      changingFields.forEach((field) => {
        Vue.set(state, field, resetFields[field]);
      });
    }
  },
  [subtitleMutations.LOADING_STATES_UPDATE]({ loadingStates }, { id, state }) {
    Vue.set(loadingStates, id, state);
  },
  [subtitleMutations.VIDEO_SUBTITLE_MAP_UPDATE]({ videoSubtitleMap }, { videoSrc, ids }) {
    Vue.set(videoSubtitleMap, videoSrc, ids);
  },
  [subtitleMutations.DURATIONS_UPDATE]({ durations }, { id, duration }) {
    Vue.set(durations, id, duration);
  },
  [subtitleMutations.NAMES_UPDATE]({ names }, { id, name }) {
    Vue.set(names, id, name);
  },
  [subtitleMutations.LANGUAGES_UPDATE]({ languages }, { id, language }) {
    Vue.set(languages, id, language);
  },
  [subtitleMutations.FORMATS_UPDATE]({ formats }, { id, format }) {
    Vue.set(formats, id, format);
  },
  [subtitleMutations.TYPES_UPDATE]({ types }, { id, type }) {
    Vue.set(types, id, type);
  },
  [subtitleMutations.RANKS_UPDATE]({ ranks }, { id, rank }) {
    Vue.set(ranks, id, rank);
  },
  [subtitleMutations.CURRENT_SUBTITLE_ID_UPDATE](state, subtitleId) {
    state.currentSubtitleId = subtitleId;
  },
  [subtitleMutations.SUBTITLE_DELAY_UPDATE](state, payload) {
    if (payload === 0) {
      state.subtitleDelay = payload;
    } else if (Math.abs((state.subtitleDelay / 1000) + payload) <= 10000) {
      state.subtitleDelay += payload * 1000;
    }
  },
  [subtitleMutations.SUBTITLE_SCALE_UPDATE](state, payload) {
    state.scaleNum = payload;
  },
  [subtitleMutations.SUBTITLE_STYLE_UPDATE](state, payload) {
    state.chosenStyle = payload;
  },
  [subtitleMutations.SUBTITLE_SIZE_UPDATE](state, payload) {
    state.chosenSize = payload;
  },
  [subtitleMutations.NO_SUBTITLE_UPDATE](state, payload) {
    state.calculatedNoSub = payload;
  },
  [subtitleMutations.SUBTITLE_TOP_UPDATE](state, payload) {
    state.subToTop = payload;
  },
};

const actions = {
  [subtitleActions.ADD_SUBTITLE_WHEN_LOADING]({ commit, dispatch }, { id, type, videoSrc }) {
    commit(subtitleMutations.LOADING_STATES_UPDATE, { id, state: 'loading' });
    dispatch(subtitleActions.ADD_TO_VIDEO_SUBTITLE_MAP, { videoSrc, ids: [id] });
    commit(subtitleMutations.TYPES_UPDATE, { id, type });
  },
  [subtitleActions.ADD_SUBTITLE_WHEN_READY]({ commit }, {
    id, format,
  }) {
    commit(subtitleMutations.LOADING_STATES_UPDATE, { id, state: 'ready' });
    commit(subtitleMutations.FORMATS_UPDATE, { id, format });
  },
  [subtitleActions.ADD_SUBTITLE_WHEN_LOADED]({ commit }, { id }) {
    commit(subtitleMutations.LOADING_STATES_UPDATE, { id, state: 'loaded' });
  },
  [subtitleActions.ADD_SUBTITLE_WHEN_FAILED]({ commit }, { id }) {
    commit(subtitleMutations.LOADING_STATES_UPDATE, { id, state: 'failed' });
  },
  [subtitleActions.INITIALIZE_VIDEO_SUBTITLE_MAP]({ commit }, { videoSrc }) {
    commit(subtitleMutations.VIDEO_SUBTITLE_MAP_UPDATE, { videoSrc, ids: [] });
  },
  [subtitleActions.ADD_TO_VIDEO_SUBTITLE_MAP]({ commit, state, dispatch }, { videoSrc, ids }) {
    const existedIds = state.videoSubtitleMap[videoSrc];
    let finalIds;
    if (!existedIds) {
      dispatch(subtitleActions.INITIALIZE_VIDEO_SUBTITLE_MAP, { videoSrc });
      finalIds = uniq([...ids]);
    } else {
      finalIds = uniq([...existedIds, ...ids]);
    }
    commit(subtitleMutations.VIDEO_SUBTITLE_MAP_UPDATE, { videoSrc, ids: finalIds });
  },
  [subtitleActions.REMOVE_FROM_VIDEO_SUBTITLE_MAP]({ commit, state, dispatch }, { videoSrc, ids }) {
    const existedIds = state.videoSubtitleMap[videoSrc];
    if (!existedIds) {
      dispatch(subtitleActions.INITIALIZE_VIDEO_SUBTITLE_MAP, { videoSrc });
    } else {
      const finalIds = [...existedIds];
      remove(finalIds, id => ids.includes(id));
      commit(subtitleMutations.VIDEO_SUBTITLE_MAP_UPDATE, { videoSrc, ids: finalIds });
    }
  },
  [subtitleActions.CHANGE_CURRENT_SUBTITLE]({ commit, getters }, id) {
    if (!id || getters.subtitleList.map(({ id }) => id).includes(id)) {
      commit(subtitleMutations.CURRENT_SUBTITLE_ID_UPDATE, id || '');
    }
  },
  [subtitleActions.OFF_SUBTITLES]({ commit }) {
    commit(subtitleMutations.CURRENT_SUBTITLE_ID_UPDATE, '');
  },
  [subtitleActions.RESET_SUBTITLES]({ commit }) {
    commit(subtitleMutations.CURRENT_SUBTITLE_ID_UPDATE, '');
  },
  [subtitleActions.RESET_ONLINE_SUBTITLES]({
    commit, state, getters, dispatch,
  }) {
    const {
      videoSubtitleMap, loadingStates, durations, names, languages, formats, types,
    } = state;
    const { originSrc } = getters;
    const idsKeeping = Object.keys(types)
      .filter(id => types[id] !== 'online' || !videoSubtitleMap[originSrc].includes(id));
    const idsRemoving = difference(Object.keys(types), idsKeeping);
    dispatch(
      subtitleActions.REMOVE_FROM_VIDEO_SUBTITLE_MAP,
      { videoSrc: originSrc, ids: idsRemoving },
    );
    const takeSupportedFields = partialRight(pick, idsKeeping);
    commit(subtitleMutations.RESET_SUBTITLES, {
      loadingStates: takeSupportedFields(loadingStates),
      durations: takeSupportedFields(durations),
      names: takeSupportedFields(names),
      languages: takeSupportedFields(languages),
      formats: takeSupportedFields(formats),
      types: takeSupportedFields(types),
    });
  },
  [subtitleActions.UPDATE_METAINFO]({ commit, state, getters }, { id, type, value }) {
    if (state[`${type}s`]) commit(`${type.toUpperCase()}S_UPDATE`, { id, [type]: value });
    const { types, ranks } = state;
    const { primaryLanguage } = getters;
    const rank = metaInfoUpdate(
      types[id], getters.subtitleList, primaryLanguage,
      type, value,
      ranks[id],
    );
    commit(subtitleMutations.RANKS_UPDATE, { id, rank });
  },
  [subtitleActions.UPDATE_SUBTITLE_DELAY]({ commit }, delta) {
    commit(subtitleMutations.SUBTITLE_DELAY_UPDATE, delta);
  },
  [subtitleActions.UPDATE_SUBTITLE_SCALE]({ commit }, delta) {
    commit(subtitleMutations.SUBTITLE_SCALE_UPDATE, delta);
  },
  [subtitleActions.UPDATE_SUBTITLE_STYLE]({ commit }, delta) {
    commit(subtitleMutations.SUBTITLE_STYLE_UPDATE, delta);
  },
  [subtitleActions.UPDATE_SUBTITLE_SIZE]({ commit }, delta) {
    commit(subtitleMutations.SUBTITLE_SIZE_UPDATE, delta);
  },
  [subtitleActions.UPDATE_NO_SUBTITLE]({ commit }, delta) {
    commit(subtitleMutations.NO_SUBTITLE_UPDATE, delta);
  },
  [subtitleActions.UPDATE_SUBTITLE_TOP]({ commit }, delta) {
    commit(subtitleMutations.SUBTITLE_TOP_UPDATE, delta);
  },
};

export default {
  state,
  mutations,
  actions,
  getters,
};