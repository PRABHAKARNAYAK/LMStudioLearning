import { Cia402State } from "motion-master-client";
import { Constants } from "../utility/constants";

/**
 * Provides a mapping between `Cia402State` enumeration values and their corresponding string representations.
 * This class is used to translate internal CIA402 state codes to human-readable or protocol-specific string constants.
 */
export class Cia402StateMapper {
  public static readonly cia402StateMap: Record<Cia402State, string> = {
    [Cia402State.FAULT]: Constants.FAULT,
    [Cia402State.FAULT_REACTION_ACTIVE]: Constants.FAULT_REACTION_ACTIVE,
    [Cia402State.NOT_READY_TO_SWITCH_ON]: Constants.NOT_READY_TO_SWITCH_ON,
    [Cia402State.OPERATION_ENABLED]: Constants.OPERATION_ENABLED,
    [Cia402State.QUICK_STOP_ACTIVE]: Constants.QUICK_STOP_ACTIVE,
    [Cia402State.READY_TO_SWITCH_ON]: Constants.READY_TO_SWITCH_ON,
    [Cia402State.SWITCHED_ON]: Constants.SWITCHED_ON,
    [Cia402State.SWITCH_ON_DISABLED]: Constants.SWITCH_ON_DISABLED,
  };
}
