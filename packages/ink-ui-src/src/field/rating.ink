<style>
span {
  color: inherit;
  cursor: pointer;
  display: inline-block;
  font-size: inherit;
}
</style>
<script>
  import StyleSet from '@stackpress/ink/dist/style/StyleSet';
  import setColor from '../utilities/style/color';
  import setDisplay from '../utilities/style/display';
  import setSize from '../utilities/style/size';
  import signal from '@stackpress/ink/dist/client/api/signal';
  //extract props
  const { 
    name, value = 0, max = 5 
  } = this.props;
  //override default styles
  const styles = new StyleSet();
  const css = this.styles();
  this.styles = () => css + styles.toString();
  //determine display
  setDisplay(this.props, styles, 'inline-block', ':host');
  //determine size
  setSize(this.props, styles, false, ':host', 'font-size');
  //determine color
  setColor(this.props, styles, false, ':host', 'color' );

  const state = signal({ 
    value,
    stars: Array.from(
      { length: max }, 
      (_, i) => i < value ? '★': '☆'
    )
  });
  const rate = value => {
    if (value == 1 && state.value.value == 1) {
      value = 0;
    } else if (value === state.value.value){
      return;
    }
    const stars = Array.from(
      { length: max }, 
      (_, i) => i < value ? '★': '☆'
    );
    state.value = { value, stars };
  };
</script>
<template type="light">
  <input type="hidden" name={name} value={String(state.value.value)} />
</template>
<template type="shadow">
  <each key=i value=star from={state.value.stars}>
    <span click={() => rate(parseInt(i) + 1)}>{star}</span>
  </each>
</template>