import { memo } from "react";
import { styled } from "styled-components";

import { SNAKE_COLORS, snakeSwatch } from "../game/snakeColors";

const LCD = {
  border: "#243214",
};

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
`;

const Swatch = styled.button<{
  $color: string;
  $selected: boolean;
  $taken: boolean;
}>`
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  border: 2px solid ${LCD.border};
  background: ${(p) => snakeSwatch(p.$color)};
  outline: ${(p) => (p.$selected ? `2px dashed ${LCD.border}` : "none")};
  outline-offset: 2px;
  opacity: ${(p) => (p.$taken ? 0.28 : 1)};
  cursor: ${(p) => (p.$taken ? "not-allowed" : "pointer")};

  &:disabled {
    cursor: not-allowed;
  }
`;

export const ColorPicker = memo(function ColorPicker({
  value,
  taken,
  disabled,
  onChange,
}: {
  value: string;
  taken?: ReadonlySet<string>;
  disabled?: boolean;
  onChange: (color: string) => void;
}) {
  return (
    <Row role="radiogroup" aria-label="Snake color">
      {SNAKE_COLORS.map((color) => {
        const isTaken = Boolean(taken?.has(color) && color !== value);
        const selected = color === value;
        return (
          <Swatch
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Color ${color}`}
            disabled={disabled === true || isTaken}
            $color={color}
            $selected={selected}
            $taken={isTaken}
            onClick={() => {
              onChange(color);
            }}
          />
        );
      })}
    </Row>
  );
});
