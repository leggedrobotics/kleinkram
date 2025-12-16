import { TopicNamesDto, TopicTypesDto } from '@kleinkram/api-dto';
import axios from 'src/api/axios';

export const allTopicsNames = async (): Promise<string[]> => {
    const response = await axios.get<TopicNamesDto>('/topic/names');
    return response.data.data;
};

export const allTopicTypes = async (): Promise<string[]> => {
    const response = await axios.get<TopicTypesDto>('/topic/types');
    return response.data.data;
};
