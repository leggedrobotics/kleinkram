import { DataType } from 'src/enums/TAG_TYPES';

export const icon = (type: DataType) => {
    switch (type) {
        case DataType.BOOLEAN:
            return 'sym_o_check_box';
        case DataType.NUMBER:
            return 'sym_o_looks_one';
        case DataType.STRING:
            return 'sym_o_text_fields';
        case DataType.DATE:
            return 'sym_o_event';
        case DataType.LOCATION:
            return 'sym_o_location_on';
        case DataType.LINK:
            return 'sym_o_link';
        case DataType.ANY:
            return 'sym_o_help';
    }
};
