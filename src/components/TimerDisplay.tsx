interface Props {
  /** 已格式化的时间文本，例如 "24:59" */
  text: string;
}

/**
 * 倒计时数字。
 * Instrument Serif 不是等宽字体，直接渲染会导致数字宽度跳动，
 * 因此逐字符定宽（按 em 计算，跟随字号缩放）。
 */
export function TimerDisplay({ text }: Props) {
  const characters = text.split('');

  return (
    <span
      className="inline-flex items-baseline justify-center leading-none"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {characters.map((character, index) => (
        <span
          key={`${character}-${index}`}
          style={{
            display: 'inline-block',
            width: character === ':' ? '0.4em' : '0.6em',
            textAlign: 'center',
          }}
        >
          {character}
        </span>
      ))}
    </span>
  );
}
